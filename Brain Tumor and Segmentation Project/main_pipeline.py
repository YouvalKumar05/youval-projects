"""
BRAIN TUMOR DETECTION & SEGMENTATION - COMPLETE PRODUCTION PROGRAM v7.0
Key Features that I have added are : 
> Dynamic epoch defaults (shows remaining epochs to train)
> Smart model loading (handles .h5 and .keras formats)
> Fixed eager execution error when loading old models
> Automatic model migration (.h5 → .keras)
> Robust error handling for resume training
> Improved epoch tracking and history management
> All previous fixes maintained

USAGE:
    python main_pipeline.py

WORKFLOW:
    1. Loads data and builds manifest
    2. Generates visualizations  
    3. Checks for existing models (smart load with format detection)
    4. Calculates remaining epochs dynamically
    5. Shows smart defaults: "default 25 epochs left"
    6. Trains with automatic resume capability
    7. Generates comprehensive metrics and predictions
    8. Saves all results with proper model format
"""

import os
import sys
import json
import logging
import warnings
import pickle
from pathlib import Path
from datetime import datetime
from typing import Tuple, List, Dict, Any, Optional

import numpy as np
import pandas as pd
import cv2
from skimage import io

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, optimizers, Sequential, Model, Input
from tensorflow.keras.applications import ResNet50
from tensorflow.keras.layers import (
    Conv2D, MaxPool2D, AveragePooling2D, Flatten, Dense, Dropout,
    BatchNormalization, Activation, Add, UpSampling2D, Concatenate,
)
from tensorflow.keras.callbacks import (
    EarlyStopping, ModelCheckpoint, ReduceLROnPlateau, CSVLogger,
)
from tensorflow.keras import backend as K

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_curve, auc, roc_auc_score,
)

# New modules for optimized training, full metrics, and reporting
from optimized_classification_config import (
    OPTIMAL_CLASSIFICATION_CONFIG,
    get_optimized_callbacks,
    create_warmup_cosine_scheduler,
)
from complete_model_evaluator import (
    CompleteClassificationEvaluator,
    CompleteSegmentationEvaluator,
)
from comprehensive_report_generator import ComprehensiveReportGenerator


warnings.filterwarnings('ignore')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('brain_tumor_pipeline.log'),
    ],
)
logger = logging.getLogger(__name__)


CONFIG = {
    'data_raw_dir': 'data/raw',
    'data_processed_dir': 'data/processed',
    'models_dir': 'models',
    'results_dir': 'results',
    'viz_dir': 'results/visualizations',
    'predictions_dir': 'results/predictions',
    'image_size': (256, 256),
    'batch_size': 16,
    'val_split': 0.15,
    'test_size': 0.15,
    'random_state': 42,
    'target_epochs_clf': 50,  # TOTAL target epochs for classification
    'target_epochs_seg': 100,  # TOTAL target epochs for segmentation (reduced from 150)
    'learning_rate': 0.001,
}

# Training history files
HISTORY_FILES = {
    'clf': 'models/clf_training_history.json',
    'seg': 'models/seg_training_history.json',
    'clf_epochs': 'models/clf_epochs_completed.txt',
    'seg_epochs': 'models/seg_epochs_completed.txt',
}

def create_directories():
    """Create necessary directories"""
    for dir_path in [CONFIG['data_processed_dir'], CONFIG['models_dir'],
                     CONFIG['results_dir'], CONFIG['viz_dir'], CONFIG['predictions_dir']]:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
    logger.info('The Directories created')

def get_user_input(prompt: str, input_type: type = int, default: Any = None) -> Any:
    """Get user input with validation"""
    try:
        value = input(prompt).strip()
        if not value and default is not None:
            return default
        return input_type(value)
    except ValueError:
        logger.warning(f'Invalid input. Using default: {default}')
        return default

# ============================================================================
# SMART MODEL LOADER - HANDLES .H5 AND .KERAS FORMATS
# ============================================================================

class SmartModelLoader:
    """
    Smart model loading with automatic format detection and migration
    Fixes eager execution error when loading old .h5 models
    """
    
    @staticmethod
    def find_model_path(base_path: str) -> Optional[Path]:
        """
        Find model file with any extension (.keras, .h5, .hdf5)
        Priority: .keras > .h5 > .hdf5
        """
        base = Path(base_path).with_suffix('')
        
        # Check in order of preference
        for ext in ['.keras', '.h5', '.hdf5']:
            model_path = Path(str(base) + ext)
            if model_path.exists():
                return model_path
        
        return None
    
    @staticmethod
    def load_model_safe(model_path: Path, custom_objects: Dict = None) -> Optional[keras.Model]:
        """
        Safely load model with automatic format detection
        Handles both .h5 and .keras formats
        """
        if not model_path.exists():
            logger.warning(f" Model not found: {model_path}")
            return None
        
        try:
            logger.info(f" Loading model from: {model_path}")
            logger.info(f"   Format: {model_path.suffix}")
            
            # Load with compile=False to avoid eager execution errors
            model = keras.models.load_model(
                str(model_path),
                custom_objects=custom_objects,
                compile=False  # CRITICAL: Prevents eager execution error
            )
            
            logger.info(f"The Model has been loaded successfully")
            logger.info(f"   Total parameters: {model.count_params():,}")
            
            # If old .h5 format, suggest migration
            if model_path.suffix == '.h5':
                logger.info("ℹ Old .h5 format detected. Will save as .keras next time.")
            
            return model
            
        except Exception as e:
            logger.error(f" Error loading model: {e}")
            logger.info(" Model will be rebuilt from scratch")
            return None
    
    @staticmethod
    def save_model_safe(model: keras.Model, base_path: str):
        """
        Save model in .keras format (modern format)
        Automatically migrates from .h5 if needed
        """
        save_path = Path(base_path).with_suffix('.keras')
        save_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            model.save(str(save_path))
            logger.info(f" Model saved: {save_path}")
            
            # Delete old .h5 file if it exists
            old_h5_path = Path(base_path).with_suffix('.h5')
            if old_h5_path.exists() and old_h5_path != save_path:
                old_h5_path.unlink()
                logger.info(f"  Deleted old .h5 file: {old_h5_path}")
                
        except Exception as e:
            logger.error(f" Error saving model: {e}")

# TRAINING HISTORY MANAGEMENT

class TrainingManager:
    """Manage training history and resume capability"""
    
    @staticmethod
    def load_epochs_completed(model_type: str) -> int:
        """Load number of epochs already completed"""
        epoch_file = HISTORY_FILES[f'{model_type}_epochs']
        if Path(epoch_file).exists():
            try:
                with open(epoch_file, 'r') as f:
                    return int(f.read().strip())
            except:
                return 0
        return 0
    
    @staticmethod
    def save_epochs_completed(model_type: str, epochs: int):
        """Save number of epochs completed"""
        epoch_file = HISTORY_FILES[f'{model_type}_epochs']
        with open(epoch_file, 'w') as f:
            f.write(str(epochs))
    
    @staticmethod
    def calculate_remaining_epochs(model_type: str, target_epochs: int) -> int:
        """
        Calculate remaining epochs to train
        Returns: remaining epochs (target - completed)
        """
        completed = TrainingManager.load_epochs_completed(model_type)
        remaining = max(0, target_epochs - completed)
        return remaining
    
    @staticmethod
    def load_training_history(model_type: str) -> Dict:
        """Load training history"""
        history_file = HISTORY_FILES[model_type]
        if Path(history_file).exists():
            try:
                with open(history_file, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    @staticmethod
    def save_training_history(model_type: str, history: Dict):
        """Save training history"""
        history_file = HISTORY_FILES[model_type]
        with open(history_file, 'w') as f:
            json.dump(history, f, indent=4)

# PART 1: DATA DISCOVERY & MANIFEST BUILDING

class DataProcessor:
    """Handle data loading and preparation"""
    
    def __init__(self, raw_dir, processed_dir):
        self.raw_dir = Path(raw_dir)
        self.processed_dir = Path(processed_dir)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        
    def discover_and_build_manifest(self) -> pd.DataFrame:
        """Discover images and build dataset manifest"""
        logger.info('=' * 80)
        logger.info('TASK #2-3: DATA DISCOVERY & MANIFEST BUILDING')
        logger.info('=' * 80)
        
        records = []
        image_extensions = ['.tif', '.tiff', '.jpg', '.jpeg', '.png']
        
        all_images = []
        for ext in image_extensions:
            found = sorted([f for f in self.raw_dir.rglob(f'*{ext}')
                           if 'mask' not in f.name.lower()])
            all_images.extend(found)
            logger.info(f'Found {len(found)} {ext} images')
        
        all_images = sorted(list(set(all_images)))
        logger.info(f' Total images found: {len(all_images)}')
        
        if len(all_images) == 0:
            logger.error(' No images found!')
            return pd.DataFrame()
        
        for img_path in all_images:
            stem = img_path.stem
            parts = stem.split('_')
            patient_id = '_'.join(parts[:4]) if len(parts) >= 4 else stem
            
            mask_path = None
            for ext in image_extensions:
                candidate = img_path.parent / f'{stem}_mask{ext}'
                if candidate.exists():
                    mask_path = candidate
                    break
            
            has_mask = 0
            if mask_path is not None:
                try:
                    mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
                    if mask is not None and mask.max() > 0:
                        has_mask = 1
                except Exception as e:
                    logger.warning(f'Error reading {mask_path}: {e}')
            
            records.append({
                'patient_id': patient_id,
                'image_path': str(img_path),
                'mask_path': str(mask_path) if mask_path else None,
                'mask': has_mask,
            })
        
        df = pd.DataFrame(records)
        
        logger.info('\n📊 MINI CHALLENGE #1: Dataset Balance')
        logger.info(f'Total samples: {len(df)}')
        logger.info(f'Class 0 (Healthy): {(df["mask"] == 0).sum()} ({(df["mask"] == 0).sum()/len(df)*100:.2f}%)')
        logger.info(f'Class 1 (Tumor): {(df["mask"] == 1).sum()} ({(df["mask"] == 1).sum()/len(df)*100:.2f}%)')
        logger.info(f'Unique patients: {df["patient_id"].nunique()}')
        
        manifest_path = self.processed_dir / 'dataset_manifest.csv'
        df.to_csv(manifest_path, index=False)
        logger.info(f'✅ Manifest saved')
        
        return df
    
    def split_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """Split data into train/val/test"""
        train, test = train_test_split(df, test_size=CONFIG['test_size'],
                                       random_state=CONFIG['random_state'])
        train, val = train_test_split(train, test_size=CONFIG['val_split'],
                                     random_state=CONFIG['random_state'])
        
        logger.info(f'\n✅ Data split: Train {len(train)}, Val {len(val)}, Test {len(test)}')
        return train, val, test

# ============================================================================
# PART 2: DATA VISUALIZATION
# ============================================================================

class DataVisualizer:
    """Handle data visualization"""
    
    @staticmethod
    def plot_class_distribution(df: pd.DataFrame):
        """Plot class distribution"""
        logger.info('\n📊 Plotting class distribution...')
        
        fig, ax = plt.subplots(figsize=(10, 6))
        counts = df['mask'].value_counts()
        colors = ['#FF6B6B', '#4ECDC4']
        bars = ax.bar(['Healthy (0)', 'Tumor (1)'], [counts.get(0, 0), counts.get(1, 0)],
                      color=colors, edgecolor='black', linewidth=2)
        
        ax.set_ylabel('Number of Samples', fontsize=12)
        ax.set_title('Brain MRI Dataset Distribution', fontsize=14, fontweight='bold')
        
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{int(height)}', ha='center', va='bottom', fontsize=11, fontweight='bold')
        
        plt.tight_layout()
        plt.savefig('results/class_distribution.png', dpi=300, bbox_inches='tight')
        plt.close()
        logger.info('✅ Saved to results/class_distribution.png')
    
    @staticmethod
    def visualize_samples(df: pd.DataFrame, num_samples: int = 6):
        """Visualize random samples"""
        logger.info(f'\n📊 Visualizing {num_samples} random samples...')
        
        fig, axs = plt.subplots(num_samples, 2, figsize=(12, 5*num_samples))
        
        for idx in range(num_samples):
            random_idx = np.random.randint(0, len(df))
            img_path = df.iloc[random_idx]['image_path']
            mask_path = df.iloc[random_idx]['mask_path']
            
            img = io.imread(img_path)
            axs[idx, 0].imshow(img, cmap='gray')
            axs[idx, 0].set_title(f'Brain MRI (Sample {idx+1})', fontsize=11, fontweight='bold')
            axs[idx, 0].axis('off')
            
            if mask_path and Path(mask_path).exists():
                mask = io.imread(mask_path)
                axs[idx, 1].imshow(mask, cmap='gray')
                axs[idx, 1].set_title(f'Mask (Class: {df.iloc[random_idx]["mask"]})', fontsize=11, fontweight='bold')
            else:
                axs[idx, 1].text(0.5, 0.5, 'No Mask', ha='center', va='center')
            axs[idx, 1].axis('off')
        
        plt.tight_layout()
        plt.savefig('results/sample_visualization.png', dpi=300, bbox_inches='tight')
        plt.close()
        logger.info('✅ Saved to results/sample_visualization.png')

# ============================================================================
# PART 3: LOSS FUNCTIONS (FIXED)
# ============================================================================

def dice_coefficient(y_true, y_pred, smooth=1e-6):
    """Dice coefficient"""
    y_true_f = K.flatten(K.cast(y_true, 'float32'))
    y_pred_f = K.flatten(K.cast(y_pred, 'float32'))
    
    intersection = K.sum(y_true_f * y_pred_f)
    union = K.sum(y_true_f) + K.sum(y_pred_f)
    
    return (2.0 * intersection + smooth) / (union + smooth)

def dice_loss(y_true, y_pred):
    """Dice loss"""
    return 1.0 - dice_coefficient(y_true, y_pred)

def combined_loss(y_true, y_pred):
    """Combined BCE + Dice loss"""
    bce = keras.losses.binary_crossentropy(y_true, y_pred)
    dice = dice_loss(y_true, y_pred)
    return 0.5 * bce + 0.5 * dice

def iou_metric(y_true, y_pred):
    """IoU metric"""
    y_true_f = K.flatten(K.cast(y_true, 'float32'))
    y_pred_f = K.flatten(K.cast(y_pred > 0.5, 'float32'))
    
    intersection = K.sum(y_true_f * y_pred_f)
    union = K.sum(K.maximum(y_true_f, y_pred_f))
    
    return (intersection + 1.0) / (union + 1.0)

# ============================================================================
# PART 4: CLASSIFICATION MODEL
# ============================================================================

class ResNet50Classifier:
    """Binary classification model"""
    
    def __init__(self, input_shape=(256, 256, 3)):
        self.input_shape = input_shape
        self.model = None
    
    def build(self, freeze_backbone=True):
        """Build ResNet50 classifier"""
        logger.info('\n' + '='*80)
        logger.info('TASK #6: BUILD CLASSIFICATION MODEL')
        logger.info('='*80)
        
        base_model = ResNet50(weights='imagenet', include_top=False,
                             input_shape=self.input_shape)
        
        if freeze_backbone:
            base_model.trainable = False
            logger.info('✅ Backbone weights frozen')
        
        inputs = Input(shape=self.input_shape)
        x = base_model(inputs, training=False)
        
        x = AveragePooling2D(pool_size=(4, 4))(x)
        x = Flatten(name='flatten')(x)
        x = Dense(256, activation='relu', kernel_regularizer=keras.regularizers.l2(0.01))(x)
        x = Dropout(0.3)(x)
        x = Dense(256, activation='relu', kernel_regularizer=keras.regularizers.l2(0.01))(x)
        x = Dropout(0.3)(x)
        outputs = Dense(2, activation='softmax')(x)
        
        self.model = Model(inputs=inputs, outputs=outputs, name='ResNet50_Classifier')
        logger.info(f'✅ Model built with {self.model.count_params():,} parameters')
        
        return self.model
    
    def compile(self, learning_rate=0.001):
        """Compile model"""
        optimizer = keras.optimizers.Adam(learning_rate=learning_rate)
        loss = keras.losses.CategoricalCrossentropy()
        metrics = [keras.metrics.CategoricalAccuracy(name='accuracy')]
        
        self.model.compile(optimizer=optimizer, loss=loss, metrics=metrics)
        logger.info('✅ Model compiled')

# ============================================================================
# PART 5: SEGMENTATION MODEL
# ============================================================================

class ResUNetSegmentation:
    """U-Net style segmentation model"""
    
    def __init__(self, input_shape=(256, 256, 1)):
        self.input_shape = input_shape
        self.model = None
    
    def resblock(self, X, f):
        """Residual block"""
        X_copy = X
        
        X = Conv2D(f, kernel_size=(1, 1), strides=(1, 1), 
                   kernel_initializer='he_normal')(X)
        X = BatchNormalization()(X)
        X = Activation('relu')(X)
        
        X = Conv2D(f, kernel_size=(3, 3), strides=(1, 1), padding='same',
                   kernel_initializer='he_normal')(X)
        X = BatchNormalization()(X)
        
        X_copy = Conv2D(f, kernel_size=(1, 1), strides=(1, 1),
                       kernel_initializer='he_normal')(X_copy)
        X_copy = BatchNormalization()(X_copy)
        
        X = Add()([X, X_copy])
        X = Activation('relu')(X)
        
        return X
    
    def build(self):
        """Build ResUNet"""
        logger.info('\n' + '='*80)
        logger.info('TASK #9: BUILD SEGMENTATION MODEL (ResUNet)')
        logger.info('='*80)
        
        X_input = Input(self.input_shape)
        
        # Encoder
        conv1 = Conv2D(16, 3, activation='relu', padding='same',
                      kernel_initializer='he_normal')(X_input)
        conv1 = BatchNormalization()(conv1)
        conv1 = Conv2D(16, 3, activation='relu', padding='same',
                      kernel_initializer='he_normal')(conv1)
        conv1 = BatchNormalization()(conv1)
        pool_1 = MaxPool2D(pool_size=(2, 2))(conv1)
        
        conv2 = self.resblock(pool_1, 32)
        pool_2 = MaxPool2D(pool_size=(2, 2))(conv2)
        
        conv3 = self.resblock(pool_2, 64)
        pool_3 = MaxPool2D(pool_size=(2, 2))(conv3)
        
        conv4 = self.resblock(pool_3, 128)
        pool_4 = MaxPool2D(pool_size=(2, 2))(conv4)
        
        conv5 = self.resblock(pool_4, 256)
        
        # Decoder
        up_1 = UpSampling2D((2, 2))(conv5)
        up_1 = Concatenate()([up_1, conv4])
        up_1 = self.resblock(up_1, 128)
        
        up_2 = UpSampling2D((2, 2))(up_1)
        up_2 = Concatenate()([up_2, conv3])
        up_2 = self.resblock(up_2, 64)
        
        up_3 = UpSampling2D((2, 2))(up_2)
        up_3 = Concatenate()([up_3, conv2])
        up_3 = self.resblock(up_3, 32)
        
        up_4 = UpSampling2D((2, 2))(up_3)
        up_4 = Concatenate()([up_4, conv1])
        up_4 = self.resblock(up_4, 16)
        
        output = Conv2D(1, (1, 1), padding='same', activation='sigmoid')(up_4)
        
        self.model = Model(inputs=X_input, outputs=output, name='ResUNet_Segmentation')
        logger.info(f'✅ ResUNet built with {self.model.count_params():,} parameters')
        
        return self.model
    
    def compile(self, learning_rate=0.0001, use_combined_loss=True):
        """Compile model"""
        optimizer = keras.optimizers.Adam(learning_rate=learning_rate)
        
        if use_combined_loss:
            loss = combined_loss
            logger.info('✅ Model compiled with Combined (BCE + Dice) loss')
        else:
            loss = dice_loss
            logger.info('✅ Model compiled with Dice loss')
        
        metrics = [dice_coefficient, iou_metric]
        self.model.compile(optimizer=optimizer, loss=loss, metrics=metrics)

# ============================================================================
# PART 6: DATA GENERATORS (Keras-compatible)
# ============================================================================

class KerasDataGenerator(tf.keras.utils.Sequence):
    """Keras-compatible data generator for classification"""
    
    def __init__(self, df, batch_size=16, target_size=(256, 256),
                 num_channels=3, is_training=False):
        self.df = df.reset_index(drop=True)
        self.batch_size = batch_size
        self.target_size = target_size
        self.num_channels = num_channels
        self.is_training = is_training
        self.indices = np.arange(len(self.df))
        
        if self.is_training:
            np.random.shuffle(self.indices)
    
    def __len__(self):
        return int(np.ceil(len(self.df) / self.batch_size))
    
    def __getitem__(self, batch_idx):
        start_idx = batch_idx * self.batch_size
        end_idx = min(start_idx + self.batch_size, len(self.df))
        batch_indices = self.indices[start_idx:end_idx]
        
        batch_images = []
        batch_labels = []
        
        for idx in batch_indices:
            row = self.df.iloc[idx]
            
            img = cv2.imread(row['image_path'], cv2.IMREAD_GRAYSCALE)
            
            if img is None:
                continue
            
            img = cv2.resize(img, self.target_size)
            img = img.astype('float32') / 255.0
            
            if self.num_channels == 3:
                img = cv2.cvtColor((img * 255).astype('uint8'), cv2.COLOR_GRAY2RGB)
                img = img.astype('float32') / 255.0
            elif self.num_channels == 1:
                img = np.expand_dims(img, axis=-1)
            
            batch_images.append(img)
            batch_labels.append(row['mask'])
        
        X = np.array(batch_images)
        y = keras.utils.to_categorical(np.array(batch_labels), num_classes=2)
        
        return X, y
    
    def on_epoch_end(self):
        if self.is_training:
            np.random.shuffle(self.indices)

class SegmentationDataGenerator(tf.keras.utils.Sequence):
    """Data generator for segmentation"""
    
    def __init__(self, df, batch_size=16, target_size=(256, 256),
                 is_training=False):
        self.df = df.reset_index(drop=True)
        self.batch_size = batch_size
        self.target_size = target_size
        self.is_training = is_training
        self.indices = np.arange(len(self.df))
        
        if self.is_training:
            np.random.shuffle(self.indices)
    
    def __len__(self):
        return int(np.ceil(len(self.df) / self.batch_size))
    
    def __getitem__(self, batch_idx):
        start_idx = batch_idx * self.batch_size
        end_idx = min(start_idx + self.batch_size, len(self.df))
        batch_indices = self.indices[start_idx:end_idx]
        
        batch_images = []
        batch_masks = []
        
        for idx in batch_indices:
            row = self.df.iloc[idx]
            
            img = cv2.imread(row['image_path'], cv2.IMREAD_GRAYSCALE)
            if img is None:
                continue
            
            img = cv2.resize(img, self.target_size)
            img = img.astype('float32') / 255.0
            img = np.expand_dims(img, axis=-1)
            
            if row['mask_path'] and Path(row['mask_path']).exists():
                mask = cv2.imread(row['mask_path'], cv2.IMREAD_GRAYSCALE)
                mask = cv2.resize(mask, self.target_size)
                mask = (mask > 127).astype('float32')
                mask = np.expand_dims(mask, axis=-1)
            else:
                mask = np.zeros((*self.target_size, 1), dtype='float32')
            
            batch_images.append(img)
            batch_masks.append(mask)
        
        X = np.array(batch_images)
        y = np.array(batch_masks)
        
        return X, y
    
    def on_epoch_end(self):
        if self.is_training:
            np.random.shuffle(self.indices)

# ============================================================================
# PART 7: MODEL EVALUATION & METRICS
# ============================================================================

class ModelEvaluator:
    """Evaluate and visualize model performance"""
    
    @staticmethod
    def plot_confusion_matrix(y_true, y_pred, title: str, save_path: str):
        """Plot confusion matrix"""
        cm = confusion_matrix(y_true, y_pred)
        
        fig, ax = plt.subplots(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=ax,
                   cbar_kws={'label': 'Count'})
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_ylabel('Ground Truth', fontsize=12)
        ax.set_xlabel('Predicted', fontsize=12)
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()
        logger.info(f'✅ Confusion matrix saved to {save_path}')
        
        return cm
    
    @staticmethod
    def plot_roc_curve(y_true, y_pred_proba, save_path: str):
        """Plot ROC curve"""
        fpr, tpr, thresholds = roc_curve(y_true, y_pred_proba)
        roc_auc = auc(fpr, tpr)
        
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (AUC = {roc_auc:.3f})')
        ax.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--', label='Random classifier')
        ax.set_xlim([0.0, 1.0])
        ax.set_ylim([0.0, 1.05])
        ax.set_xlabel('False Positive Rate', fontsize=12)
        ax.set_ylabel('True Positive Rate', fontsize=12)
        ax.set_title('ROC Curve', fontsize=14, fontweight='bold')
        ax.legend(loc='lower right', fontsize=11)
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()
        logger.info(f'✅ ROC curve saved to {save_path}')
        
        return roc_auc
    
    @staticmethod
    def save_classification_report(y_true, y_pred, save_path: str):
        """Save detailed classification report"""
        report = classification_report(y_true, y_pred, 
                                      target_names=['Healthy', 'Tumor'])
        
        with open(save_path, 'w') as f:
            f.write("="*60 + "\n")
            f.write("CLASSIFICATION REPORT\n")
            f.write("="*60 + "\n\n")
            f.write(report)
            f.write("\n\n" + "="*60 + "\n")
            f.write("METRICS SUMMARY\n")
            f.write("="*60 + "\n")
            f.write(f"Accuracy:  {accuracy_score(y_true, y_pred):.4f}\n")
            f.write(f"Precision: {precision_score(y_true, y_pred, average='weighted'):.4f}\n")
            f.write(f"Recall:    {recall_score(y_true, y_pred, average='weighted'):.4f}\n")
            f.write(f"F1-Score:  {f1_score(y_true, y_pred, average='weighted'):.4f}\n")
        
        logger.info(f'✅ Classification report saved to {save_path}')

# ============================================================================
# PART 8: PREDICTIONS & VISUALIZATION
# ============================================================================

class PredictionVisualizer:
    """Generate prediction visualizations"""
    
    @staticmethod
    def visualize_classification_predictions(df: pd.DataFrame, clf_model: Model,
                                            num_predictions: int, save_dir: str):
        """Generate classification prediction visualizations"""
        logger.info(f'\n🎨 Generating {num_predictions} classification predictions...')
        
        selected_indices = np.random.choice(len(df), min(num_predictions, len(df)), replace=False)
        
        for pred_num, idx in enumerate(selected_indices, 1):
            row = df.iloc[idx]
            img = cv2.imread(row['image_path'], cv2.IMREAD_GRAYSCALE)
            img_resized = cv2.resize(img, (256, 256))
            img_normalized = img_resized.astype('float32') / 255.0
            img_rgb = cv2.cvtColor((img_normalized * 255).astype('uint8'), cv2.COLOR_GRAY2RGB)
            img_rgb = img_rgb.astype('float32') / 255.0
            
            X = np.expand_dims(img_rgb, axis=0)
            pred_proba = clf_model.predict(X, verbose=0)
            pred_class = np.argmax(pred_proba[0])
            pred_conf = np.max(pred_proba[0])
            
            class_names = ['Healthy', 'Tumor']
            true_class = class_names[int(row['mask'])]
            pred_label = class_names[pred_class]
            
            fig, axes = plt.subplots(1, 2, figsize=(12, 5))
            
            axes[0].imshow(img, cmap='gray')
            axes[0].set_title('Original MRI', fontsize=12, fontweight='bold')
            axes[0].axis('off')
            
            axes[1].text(0.5, 0.7, 'Classification Result', ha='center', fontsize=14, fontweight='bold',
                        transform=axes[1].transAxes)
            axes[1].text(0.5, 0.55, f'Predicted: {pred_label}', ha='center', fontsize=12,
                        transform=axes[1].transAxes)
            axes[1].text(0.5, 0.45, f'Confidence: {pred_conf*100:.2f}%', ha='center', fontsize=11,
                        transform=axes[1].transAxes, color='green' if pred_class == int(row['mask']) else 'red')
            axes[1].text(0.5, 0.35, f'Ground Truth: {true_class}', ha='center', fontsize=11,
                        transform=axes[1].transAxes)
            axes[1].axis('off')
            
            plt.tight_layout()
            save_path = f"{save_dir}/clf_prediction_{pred_num:03d}.png"
            plt.savefig(save_path, dpi=200, bbox_inches='tight')
            plt.close()
            
            logger.info(f'  ✅ Prediction {pred_num}/{len(selected_indices)} saved')
    
    @staticmethod
    def visualize_segmentation_predictions(df: pd.DataFrame, seg_model: Model,
                                          num_predictions: int, save_dir: str):
        """Generate segmentation prediction visualizations"""
        logger.info(f'\n🎨 Generating {num_predictions} segmentation predictions...')
        
        tumor_df = df[df['mask'] == 1].reset_index(drop=True)
        if len(tumor_df) == 0:
            logger.warning('No tumor samples for segmentation visualization')
            return
        
        selected_indices = np.random.choice(len(tumor_df), min(num_predictions, len(tumor_df)), replace=False)
        
        for pred_num, idx in enumerate(selected_indices, 1):
            row = tumor_df.iloc[idx]
            
            # Read image
            img = cv2.imread(row['image_path'], cv2.IMREAD_GRAYSCALE)
            img_resized = cv2.resize(img, (256, 256))
            img_normalized = img_resized.astype('float32') / 255.0
            X = np.expand_dims(np.expand_dims(img_normalized, axis=-1), axis=0)
            
            # Predict
            pred_mask = seg_model.predict(X, verbose=0)[0, :, :, 0]
            pred_mask_binary = (pred_mask > 0.5).astype('uint8') * 255
            
            # Read ground truth
            true_mask = cv2.imread(row['mask_path'], cv2.IMREAD_GRAYSCALE) if row['mask_path'] and Path(row['mask_path']).exists() else None
            
            # Visualize
            fig, axes = plt.subplots(2, 2, figsize=(12, 12))
            
            # Original MRI
            axes[0, 0].imshow(img, cmap='gray')
            axes[0, 0].set_title('Original MRI', fontsize=11, fontweight='bold')
            axes[0, 0].axis('off')
            
            # Ground truth mask
            if true_mask is not None:
                axes[0, 1].imshow(true_mask, cmap='gray')
                axes[0, 1].set_title('Ground Truth Mask', fontsize=11, fontweight='bold')
            axes[0, 1].axis('off')
            
            # Predicted mask
            axes[1, 0].imshow(pred_mask_binary, cmap='gray')
            axes[1, 0].set_title('AI Predicted Mask', fontsize=11, fontweight='bold')
            axes[1, 0].axis('off')
            
            # Overlay
            img_rgb = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
            img_rgb[pred_mask_binary == 255] = [0, 255, 0]  # Green overlay
            axes[1, 1].imshow(img_rgb)
            axes[1, 1].set_title('MRI + Predicted Tumor (Green)', fontsize=11, fontweight='bold')
            axes[1, 1].axis('off')
            
            plt.tight_layout()
            save_path = f"{save_dir}/seg_prediction_{pred_num:03d}.png"
            plt.savefig(save_path, dpi=200, bbox_inches='tight')
            plt.close()
            
            logger.info(f'  ✅ Prediction {pred_num}/{len(selected_indices)} saved')

# ============================================================================
# MAIN PIPELINE WITH DYNAMIC EPOCHS
# ============================================================================

def main():
    """Execute complete pipeline"""
    
    print('\n' + '='*80)
    print('BRAIN TUMOR DETECTION & SEGMENTATION - COMPLETE PRODUCTION PIPELINE v7.0')
    print('Smart Resume + Dynamic Epochs + Fixed Model Loading')
    print('='*80 + '\n')
    
    create_directories()
    
    # ========== DATA LOADING ==========
    processor = DataProcessor(CONFIG['data_raw_dir'], CONFIG['data_processed_dir'])
    df = processor.discover_and_build_manifest()
    
    if len(df) == 0:
        logger.error('No data found. Exiting.')
        return
    
    train_df, val_df, test_df = processor.split_data(df)
    
    visualizer = DataVisualizer()
    visualizer.plot_class_distribution(df)
    visualizer.visualize_samples(df, num_samples=6)
    
    # ========== USER INPUT: DYNAMIC EPOCHS ==========
    print('\n' + '='*80)
    print('TRAINING CONFIGURATION')
    print('='*80)
    
    # Classification epochs with DYNAMIC default
    clf_epochs_completed = TrainingManager.load_epochs_completed('clf')
    clf_remaining = TrainingManager.calculate_remaining_epochs(
        'clf', CONFIG['target_epochs_clf']
    )
    
    if clf_epochs_completed > 0:
        print(f'\n📊 Classification: {clf_epochs_completed}/{CONFIG["target_epochs_clf"]} epochs completed')
        prompt = f'   Enter additional epochs to train (default {clf_remaining} epochs left): '
        default = clf_remaining
    else:
        print(f'\n📊 Classification: No training yet')
        prompt = f'   Enter epochs for classification (default {CONFIG["target_epochs_clf"]} total): '
        default = CONFIG['target_epochs_clf']
    
    epochs_clf = get_user_input(prompt, int, default)
    
    # Segmentation epochs with DYNAMIC default
    seg_epochs_completed = TrainingManager.load_epochs_completed('seg')
    seg_remaining = TrainingManager.calculate_remaining_epochs(
        'seg', CONFIG['target_epochs_seg']
    )
    
    if seg_epochs_completed > 0:
        print(f'\n📊 Segmentation: {seg_epochs_completed}/{CONFIG["target_epochs_seg"]} epochs completed')
        prompt = f'   Enter additional epochs to train (default {seg_remaining} epochs left): '
        default = seg_remaining
    else:
        print(f'\n📊 Segmentation: No training yet')
        prompt = f'   Enter epochs for segmentation (default {CONFIG["target_epochs_seg"]} total): '
        default = CONFIG['target_epochs_seg']
    
    epochs_seg = get_user_input(prompt, int, default)
    
    # ========== CLASSIFICATION WITH SMART LOADING ==========
    # ========== CLASSIFICATION WITH SMART LOADING (v10.0 FIXED) ==========
    unique_classes = train_df['mask'].unique()
    if len(unique_classes) >= 2:
        logger.info('\n' + '='*80)
        logger.info('TASK #6-7: CLASSIFICATION (TUMOR DETECTION) - v10.0 FIXED')
        logger.info('='*80)

        # Import NEW classifier v10.0
        from model_classifier import (
            BrainTumorClassifier_v10,
            calculate_class_weights,
            FocalLoss,
            CBAM_Attention,
            AdvancedAugmentation,
            ProgressiveUnfreezingCallback
        )

        # Calculate class weights for imbalanced data
        class_weights = calculate_class_weights(train_df, mask_column='mask')

        # Smart model loading
        clf_model_base = f"{CONFIG['models_dir']}/classifier_best_v10"
        clf_model_path = SmartModelLoader.find_model_path(clf_model_base)

        if clf_model_path:
            logger.info(f'\n✅ Found existing classification model v10.0')

            # Custom objects for Focal Loss + CBAM + Augmentation
            custom_objects = {
                'FocalLoss': FocalLoss,
                'CBAM_Attention': CBAM_Attention,
                'AdvancedAugmentation': AdvancedAugmentation,
                'focal_loss': FocalLoss(alpha=0.75, gamma=2.0),
            }

            try:
                # Load existing model
                loaded_model = SmartModelLoader.load_model_safe(
                    clf_model_path,
                    custom_objects=custom_objects
                )

                # Wrap in classifier object
                classifier = BrainTumorClassifier_v10(input_shape=(256, 256, 3))
                classifier.model = loaded_model

                # Recompile with Focal Loss
                classifier.compile_model(
                    learning_rate=CONFIG['learning_rate'],
                    use_focal_loss=True,
                    class_weights=class_weights
                )
                logger.info('✅ Model loaded and recompiled successfully')

            except Exception as e:
                logger.error(f'❌ Error loading model: {e}')
                logger.info('🔨 Building new model from scratch (v10.0)...')

                classifier = BrainTumorClassifier_v10(input_shape=(256, 256, 3))
                classifier.build_model(freeze_backbone=True, use_augmentation=True)
                classifier.compile_model(
                    learning_rate=1e-4,
                    use_focal_loss=True,
                    class_weights=class_weights
                )
        else:
            logger.info('\n🔨 Building NEW classification model v10.0 from scratch...')

            classifier = BrainTumorClassifier_v10(input_shape=(256, 256, 3))
            classifier.build_model(freeze_backbone=True, use_augmentation=True)
            classifier.compile_model(
                learning_rate=1e-4,
                use_focal_loss=True,
                class_weights=class_weights
            )

        # Train classifier with PROGRESSIVE UNFREEZING
        train_gen = KerasDataGenerator(
            train_df, batch_size=CONFIG['batch_size'],
            target_size=CONFIG['image_size'], num_channels=3, is_training=True
        )

        val_gen = KerasDataGenerator(
            val_df, batch_size=CONFIG['batch_size'],
            target_size=CONFIG['image_size'], num_channels=3, is_training=False
        )

        callbacks = [
            EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True),
            ModelCheckpoint(clf_model_base + '.keras', save_best_only=True, verbose=1),
            CSVLogger(f"{CONFIG['models_dir']}/clf_training.log", append=True),
            ProgressiveUnfreezingCallback(
                classifier_obj=classifier,
                unfreeze_epoch=15,
                num_layers=50,
                new_lr=1e-5
            )
        ]

        logger.info(f'\n🚀 Training classifier v10.0 ({epochs_clf} epochs)...')
        logger.info('   Stage 1 (epochs 0-14): Frozen backbone')
        logger.info('   Stage 2 (epochs 15+): Unfrozen backbone (fine-tuning)')

        history_clf = classifier.model.fit(
            train_gen,
            validation_data=val_gen,
            epochs=epochs_clf,
            callbacks=callbacks,
            class_weight=class_weights,   # CRITICAL
            verbose=1
        )

        # Save epochs completed
        TrainingManager.save_epochs_completed('clf', clf_epochs_completed + epochs_clf)

        # Evaluate on test set
        logger.info('\n📊 Evaluating classifier v10.0 on test set...')
        test_gen = KerasDataGenerator(
            test_df, batch_size=CONFIG['batch_size'],
            target_size=CONFIG['image_size'], num_channels=3, is_training=False
        )

        test_pred_proba = classifier.model.predict(test_gen, verbose=0)
        test_pred = np.argmax(test_pred_proba, axis=1)
        test_true = test_df['mask'].values[:len(test_pred)]

        # Save metrics
        ModelEvaluator.plot_confusion_matrix(
            test_true, test_pred,
            'Classification Confusion Matrix (v10.0 Fixed)',
            f"{CONFIG['results_dir']}/confusion_matrix_clf_v10.png"
        )

        ModelEvaluator.plot_roc_curve(
            test_true, test_pred_proba[:, 1],
            f"{CONFIG['results_dir']}/roc_curve_clf_v10.png"
        )

        ModelEvaluator.save_classification_report(
            test_true, test_pred,
            f"{CONFIG['results_dir']}/classification_report_v10.txt"
        )

        logger.info('✅ Classification v10.0 evaluation complete')
            # ========= COMPLETE CLASSIFICATION EVALUATION (entire test set) =========
        logger.info("\n" + "="*80)
        logger.info("COMPLETE MODEL EVALUATION - CLASSIFICATION")
        logger.info("="*80)

        test_gen_full = KerasDataGenerator(
            test_df,
            batch_size=CONFIG["batch_size"],
            target_size=CONFIG["image_size"],
            num_channels=3,
            is_training=False,
        )

        clf_evaluator = CompleteClassificationEvaluator(
            model=classifier.model,
            test_generator=test_gen_full,
            test_df=test_df,
        )

        final_clf_metrics = clf_evaluator.evaluate_complete_model()
        clf_evaluator.save_final_report("results/FINAL_CLASSIFICATION_METRICS.json")
        clf_evaluator.generate_publication_plots("results/publication_figures")

        logger.info("✅ Saved complete classification metrics and plots.")


    else:
        logger.warning('\n⚠️ Single-class dataset - skipping classification')


    
    # ========== SEGMENTATION WITH SMART LOADING ==========
    logger.info('\n' + '='*80)
    logger.info('TASK #8-11: SEGMENTATION (TUMOR LOCALIZATION)')
    logger.info('='*80)
    
    seg_df = df[df['mask'] == 1].reset_index(drop=True)
    
    if len(seg_df) == 0:
        logger.error('No tumor samples for segmentation')
        return
    
    seg_train, seg_val = train_test_split(seg_df, test_size=0.15,
                                         random_state=CONFIG['random_state'])
    
    logger.info(f'Segmentation dataset: {len(seg_train)} train, {len(seg_val)} val')
    
    # Smart model loading
    seg_model_base = f"{CONFIG['models_dir']}/segmentation_best"
    seg_model_path = SmartModelLoader.find_model_path(seg_model_base)
    
    if seg_model_path:
        logger.info(f'\n✅ Found existing segmentation model')
        segmenter = ResUNetSegmentation(input_shape=(256, 256, 1))
        segmenter.model = SmartModelLoader.load_model_safe(
            seg_model_path,
            custom_objects={'dice_coefficient': dice_coefficient,
                           'iou_metric': iou_metric,
                           'combined_loss': combined_loss}
        )
        
        if segmenter.model is None:
            logger.info('🔨 Model loading failed. Building new model...')
            segmenter.build()
            segmenter.compile(learning_rate=0.0001, use_combined_loss=True)
        else:
            # Recompile
            segmenter.compile(learning_rate=0.0001, use_combined_loss=True)
            logger.info('✅ Model recompiled and ready for training')
    else:
        logger.info('\n🔨 Building new segmentation model...')
        segmenter = ResUNetSegmentation(input_shape=(256, 256, 1))
        segmenter.build()
        segmenter.compile(learning_rate=0.0001, use_combined_loss=True)
    
    # Train segmenter
    seg_train_gen = SegmentationDataGenerator(
        seg_train, batch_size=CONFIG['batch_size'],
        target_size=CONFIG['image_size'], is_training=True
    )
    
    seg_val_gen = SegmentationDataGenerator(
        seg_val, batch_size=CONFIG['batch_size'],
        target_size=CONFIG['image_size'], is_training=False
    )
    
    callbacks_seg = [
        EarlyStopping(monitor='val_loss', patience=20, restore_best_weights=True),
        ModelCheckpoint(seg_model_base + '.keras', save_best_only=True, verbose=1),
        CSVLogger(f"{CONFIG['models_dir']}/seg_training.log", append=True),
    ]
    
    logger.info(f'\n🚀 Training segmenter ({epochs_seg} epochs)...')
    history_seg = segmenter.model.fit(
        seg_train_gen,
        validation_data=seg_val_gen,
        epochs=epochs_seg,
        callbacks=callbacks_seg,
        verbose=1
    )
    
    # Save epochs completed
    TrainingManager.save_epochs_completed('seg', seg_epochs_completed + epochs_seg)
    
    # =====================================================================
    # ADD THIS BLOCK - GENERATE SEGMENTATION VISUALIZATIONS
    # =====================================================================
    # =====================================================================
# ADD THIS BLOCK - GENERATE SEGMENTATION VISUALIZATIONS
# =====================================================================

    logger.info('\n' + '=' * 80)
    logger.info('GENERATING SEGMENTATION VISUALIZATIONS')
    logger.info('=' * 80)
        
    try:
            from segmentation_visualizer import SegmentationVisualizer
            
            seg_visualizer = SegmentationVisualizer(CONFIG['results_dir'])
            
            # 1. If we trained this session, show training curves
            if history_seg.history.get('loss'):
                logger.info('\n📈 Generating training curves from current session...')
                seg_visualizer.plot_all_metrics(history_seg, save_prefix='segmentation')
            else:
                logger.info('\n⚠️  No training in current session - skipping training curves')
            
            # 2. ALWAYS evaluate complete model on test set
            logger.info('\n📊 Evaluating complete trained model on test set...')
            test_metrics = seg_visualizer.evaluate_on_test_set(
                model=segmenter.model,
                test_df=test_df,
                save_prefix='segmentation'
            )
                # ========= COMPLETE SEGMENTATION EVALUATION =========
            logger.info("\n" + "="*80)
            logger.info("COMPLETE SEGMENTATION MODEL EVALUATION")
            logger.info("="*80)

            # Use only tumor samples for segmentation evaluation
            seg_test_df = test_df[test_df["mask"] == 1].reset_index(drop=True)
            if len(seg_test_df) > 0:
                seg_test_gen = SegmentationDataGenerator(
                    seg_test_df,
                    batch_size=CONFIG["batch_size"],
                    target_size=CONFIG["image_size"],
                    is_training=False,
                )

                seg_evaluator = CompleteSegmentationEvaluator(
                    model=segmenter.model,
                    test_generator=seg_test_gen,
                )

                final_seg_metrics = seg_evaluator.evaluate_complete_model()
                seg_evaluator.save_final_report("results/FINAL_SEGMENTATION_METRICS.json")

                logger.info("✅ Saved complete segmentation metrics.")
            else:
                logger.warning("⚠️ No tumor samples in test set for segmentation evaluation.")


            
            
            # 3. Generate detailed prediction visualizations
            logger.info('\n🖼️  Generating detailed prediction samples...')
            seg_visualizer.visualize_segmentation_predictions(
                test_df,
                segmenter.model,
                num_samples=10,  # Increased from 5
                save_dir=CONFIG['predictions_dir']
            )
            
            logger.info('\n✅ All segmentation visualizations complete!')
            logger.info(f'\n📁 Results saved in: {CONFIG["results_dir"]}/')
            logger.info(f'   - Training curves: {CONFIG["results_dir"]}/visualizations/')
            logger.info(f'   - Test metrics: {CONFIG["results_dir"]}/visualizations/')
            logger.info(f'   - Predictions: {CONFIG["predictions_dir"]}/')


    except Exception as e:
        logger.error(f'❌ Error generating segmentation visualizations: {e}')

    logger.info('✅ Segmentation training complete')

    
    # ========== PREDICTIONS ==========
    print('\n' + '='*80)
    print('DEMO PREDICTIONS')
    print('='*80)
    
    num_clf_preds = get_user_input('\nHow many classification predictions? (default 5): ', int, 5)
    num_seg_preds = get_user_input('How many segmentation predictions? (default 5): ', int, 5)
    
    if len(unique_classes) >= 2:
        PredictionVisualizer.visualize_classification_predictions(
            test_df, classifier.model, num_clf_preds, CONFIG['predictions_dir']
        )
    
    PredictionVisualizer.visualize_segmentation_predictions(
        df, segmenter.model, num_seg_preds, CONFIG['predictions_dir']
    )
    
        # ========= GENERATE COMPREHENSIVE FINAL REPORT =========
    logger.info("\n" + "="*80)
    logger.info("GENERATING COMPREHENSIVE FINAL REPORT")
    logger.info("="*80)

    try:
        report_generator = ComprehensiveReportGenerator(
            clf_metrics_path="results/FINAL_CLASSIFICATION_METRICS.json",
            seg_metrics_path="results/FINAL_SEGMENTATION_METRICS.json",
        )

        report_generator.generate_complete_report(
            "results/FINAL_COMPREHENSIVE_REPORT.txt"
        )
        report_generator.export_to_csv("results")

        logger.info("✅ Comprehensive report and CSV exports generated.")
        logger.info("   - Text: results/FINAL_COMPREHENSIVE_REPORT.txt")
        logger.info("   - Markdown: results/FINAL_COMPREHENSIVE_REPORT.md")
        logger.info("   - CSVs: results/classification_metrics.csv, results/segmentation_metrics.csv")
    except Exception as e:
        logger.warning(f"⚠️ Could not generate comprehensive report: {e}")
 
 
    
    # ========== FINAL SUMMARY ==========
    logger.info('\n' + '='*80)
    logger.info('✅ PIPELINE COMPLETE!')
    logger.info('='*80)
    
    logger.info('\n📊 Results saved to:')
    logger.info(f'  - Models: {CONFIG["models_dir"]}/')
    logger.info(f'  - Predictions: {CONFIG["predictions_dir"]}/')
    logger.info(f'  - Metrics: {CONFIG["results_dir"]}/')
    logger.info(f'  - Data manifest: {CONFIG["data_processed_dir"]}/dataset_manifest.csv')
    
    print('\n' + '='*80)
    print('🎉 Brain Tumor Detection & Segmentation Pipeline Completed Successfully!')
    print('='*80 + '\n')

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info('⚠️  Pipeline interrupted by user')
        sys.exit(0)
    except Exception as e:
        logger.error(f'❌ Error: {e}', exc_info=True)
        sys.exit(1)
