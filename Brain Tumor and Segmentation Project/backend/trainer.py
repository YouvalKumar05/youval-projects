import os
import json
import logging
import threading
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import backend as K
from tensorflow.keras.callbacks import Callback

from model_classifier import (
    BrainTumorClassifier_v10,
    calculate_class_weights,
    FocalLoss,
    CBAM_Attention,
    AdvancedAugmentation,
    ProgressiveUnfreezingCallback
)

logger = logging.getLogger(__name__)

# Keras data generator compatible with our training script
class KerasDataGenerator(tf.keras.utils.Sequence):
    def __init__(self, df, batch_size=16, target_size=(256, 256), num_channels=3, is_training=False):
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
        import cv2
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
            batch_labels.append(int(row['mask']))
            
        X = np.array(batch_images)
        y = keras.utils.to_categorical(np.array(batch_labels), num_classes=2)
        return X, y
        
    def on_epoch_end(self):
        if self.is_training:
            np.random.shuffle(self.indices)


class LiveTrainingProgressCallback(Callback):
    """Callback to update training state in real-time for dashboard streaming"""
    def __init__(self, state_dict, update_callback=None):
        super().__init__()
        self.state_dict = state_dict
        self.update_callback = update_callback
        
    def on_epoch_begin(self, epoch, logs=None):
        self.state_dict['current_epoch'] = epoch + 1
        self.state_dict['status'] = 'Training'
        if self.update_callback:
            self.update_callback()
            
    def on_epoch_end(self, epoch, logs=None):
        logs = logs or {}
        # Capture metrics
        metrics = {
            'epoch': epoch + 1,
            'loss': float(logs.get('loss', 0.0)),
            'accuracy': float(logs.get('accuracy', 0.0)),
            'val_loss': float(logs.get('val_loss', 0.0)),
            'val_accuracy': float(logs.get('val_accuracy', 0.0)),
            'precision': float(logs.get('precision', 0.0)),
            'val_precision': float(logs.get('val_precision', 0.0)),
            'recall': float(logs.get('recall', 0.0)),
            'val_recall': float(logs.get('val_recall', 0.0)),
        }
        self.state_dict['history'].append(metrics)
        self.state_dict['latest_metrics'] = metrics
        
        # Save epoch tracking to disk for resume capability
        try:
            completed_epochs = self.state_dict['previously_completed'] + epoch + 1
            epoch_tracker_file = Path(self.state_dict['models_dir']) / f"epochs_completed_{self.state_dict['backbone']}.txt"
            epoch_tracker_file.write_text(str(completed_epochs))
            
            # Write to training log CSV
            log_file = Path(self.state_dict['models_dir']) / f"clf_training_{self.state_dict['backbone']}.log"
            header_needed = not log_file.exists()
            df_log = pd.DataFrame([metrics])
            df_log.to_csv(log_file, mode='a', header=header_needed, index=False)
        except Exception as e:
            logger.error(f"Error saving epoch log: {e}")
            
        if self.update_callback:
            self.update_callback()


class BackgroundTrainer:
    def __init__(self, root_dir, models_dir):
        self.root_dir = Path(root_dir)
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        self.state = {
            'is_running': False,
            'status': 'Idle', # 'Idle', 'Loading Data', 'Building Model', 'Training', 'Completed', 'Stopped', 'Error'
            'backbone': 'resnet50',
            'num_slices': 1000,
            'total_epochs': 5,
            'current_epoch': 0,
            'learning_rate': 1e-4,
            'loss_function': 'focal_loss',
            'previously_completed': 0,
            'latest_metrics': {},
            'history': [],
            'error_message': None,
            'models_dir': str(self.models_dir)
        }
        
        self.thread = None
        self._stop_event = threading.Event()
        self.listeners = []
        
    def get_status(self):
        return self.state
        
    def emit_update(self):
        for listener in list(self.listeners):
            try:
                listener(self.state)
            except Exception:
                pass
            
    def stop_training(self):
        if self.state['is_running']:
            self._stop_event.set()
            self.state['status'] = 'Stopping...'
            self.emit_update()
            return True
        return False
        
    def start_training(self, backbone='resnet50', num_slices=1000, epochs=5, lr=1e-4, loss_function='focal_loss'):
        if self.state['is_running']:
            return False, "Training is already in progress."
            
        self._stop_event.clear()
        self.state['is_running'] = True
        self.state['status'] = 'Initializing'
        self.state['backbone'] = backbone
        self.state['num_slices'] = num_slices
        self.state['total_epochs'] = epochs
        self.state['current_epoch'] = 0
        self.state['learning_rate'] = lr
        self.state['loss_function'] = loss_function
        self.state['history'] = []
        self.state['latest_metrics'] = {}
        self.state['error_message'] = None
        
        # Load pre-existing completed epochs count
        epoch_tracker_file = self.models_dir / f"epochs_completed_{backbone}.txt"
        if epoch_tracker_file.exists():
            try:
                self.state['previously_completed'] = int(epoch_tracker_file.read_text().strip())
            except:
                self.state['previously_completed'] = 0
        else:
            self.state['previously_completed'] = 0
            
        # Load historical logs if available
        log_file = self.models_dir / f"clf_training_{backbone}.log"
        if log_file.exists():
            try:
                df = pd.read_csv(log_file)
                self.state['history'] = df.to_dict(orient='records')
            except Exception as e:
                logger.warning(f"Could not load previous training logs: {e}")
                
        self.emit_update()
        
        self.thread = threading.Thread(target=self._training_worker)
        self.thread.daemon = True
        self.thread.start()
        return True, "Training started in background."
        
    def _training_worker(self):
        try:
            self.state['status'] = 'Loading Data'
            self.emit_update()
            
            # 1. Load manifest
            manifest_path = self.root_dir / 'data' / 'processed' / 'dataset_manifest.csv'
            if not manifest_path.exists():
                raise FileNotFoundError(f"Manifest file not found at {manifest_path}")
                
            df = pd.read_csv(manifest_path)
            
            # Deduplicate by filename (same logic as app.py)
            df['_fname'] = df['image_path'].apply(lambda p: Path(p).name)
            df = df.drop_duplicates(subset=['patient_id', '_fname']).drop(columns=['_fname'])
            df = df.reset_index(drop=True)
            
            # 2. Subset data according to user request
            n_slices = self.state['num_slices']
            if n_slices > 0 and n_slices < len(df):
                # Perform stratified sampling to preserve class distribution
                # If subset is very small, fall back to simple split
                try:
                    df_subset, _ = train_test_split(
                        df, 
                        train_size=n_slices, 
                        stratify=df['mask'], 
                        random_state=42
                    )
                except Exception as e:
                    logger.warning(f"Stratification failed: {e}. Falling back to simple subset.")
                    df_subset = df.sample(n=n_slices, random_state=42)
            else:
                df_subset = df
                
            self.state['status'] = 'Splitting Data'
            self.emit_update()
            
            # Train / Validation split (85 / 15)
            train_df, val_df = train_test_split(df_subset, test_size=0.15, random_state=42)
            
            class_weights = calculate_class_weights(train_df, mask_column='mask')
            
            # Data generators
            train_gen = KerasDataGenerator(train_df, batch_size=16, is_training=True)
            val_gen = KerasDataGenerator(val_df, batch_size=16, is_training=False)
            
            self.state['status'] = 'Building Model'
            self.emit_update()
            
            # 3. Model setup with smart load/resume
            model_path = self.models_dir / f"classifier_best_{self.state['backbone']}.keras"
            classifier = BrainTumorClassifier_v10(
                input_shape=(256, 256, 3), 
                num_classes=2, 
                backbone_name=self.state['backbone']
            )
            
            # Setup custom objects for load
            custom_objects = {
                'FocalLoss': FocalLoss,
                'CBAM_Attention': CBAM_Attention,
                'AdvancedAugmentation': AdvancedAugmentation,
                'focal_loss': FocalLoss(alpha=0.60, gamma=1.5),
            }
            
            if model_path.exists():
                logger.info(f"Resuming classification model from checkpoint: {model_path}")
                try:
                    classifier.model = keras.models.load_model(
                        str(model_path), 
                        custom_objects=custom_objects, 
                        compile=False
                    )
                    classifier.compile_model(
                        learning_rate=self.state['learning_rate'],
                        use_focal_loss=(self.state['loss_function'] == 'focal_loss'),
                        class_weights=class_weights
                    )
                    logger.info("Resumed checkpoint loaded successfully.")
                except Exception as e:
                    logger.error(f"Error loading checkpoint: {e}. Rebuilding model.")
                    classifier.build_model(freeze_backbone=True, use_augmentation=True)
                    classifier.compile_model(
                        learning_rate=self.state['learning_rate'],
                        use_focal_loss=(self.state['loss_function'] == 'focal_loss'),
                        class_weights=class_weights
                    )
            else:
                logger.info("No checkpoint found. Creating fresh model.")
                classifier.build_model(freeze_backbone=True, use_augmentation=True)
                classifier.compile_model(
                    learning_rate=self.state['learning_rate'],
                    use_focal_loss=(self.state['loss_function'] == 'focal_loss'),
                    class_weights=class_weights
                )
                
            # Callbacks
            progress_callback = LiveTrainingProgressCallback(self.state, self.emit_update)
            
            checkpoint_callback = keras.callbacks.ModelCheckpoint(
                filepath=str(model_path),
                monitor='val_loss',
                save_best_only=True,
                verbose=1
            )
            
            # Progressive unfreezing: if backbone was frozen, unfreeze at epoch 3 (or epoch 10 if training is longer)
            unfreeze_ep = min(3, max(1, self.state['total_epochs'] // 3))
            unfreeze_callback = ProgressiveUnfreezingCallback(
                classifier_obj=classifier,
                unfreeze_epoch=unfreeze_ep,
                num_layers=25,
                new_lr=self.state['learning_rate'] * 0.1
            )
            
            callbacks_list = [progress_callback, checkpoint_callback, unfreeze_callback]
            
            # Custom Stop Callback to check stop event
            class StopTrainingCallback(keras.callbacks.Callback):
                def __init__(self, stop_evt):
                    super().__init__()
                    self.stop_evt = stop_evt
                def on_epoch_begin(self, epoch, logs=None):
                    if self.stop_evt.is_set():
                        self.model.stop_training = True
            
            callbacks_list.append(StopTrainingCallback(self._stop_event))
            
            # 4. Fit model
            self.state['status'] = 'Training'
            self.emit_update()
            
            classifier.model.fit(
                train_gen,
                validation_data=val_gen,
                epochs=self.state['total_epochs'],
                callbacks=callbacks_list,
                class_weight=class_weights,
                verbose=1
            )
            
            if self._stop_event.is_set():
                self.state['status'] = 'Stopped'
            else:
                self.state['status'] = 'Completed'
                
                # Copy the trained model parameters to the default file classifier_best_v10.keras so that 
                # the backend can use it for inference immediately!
                try:
                    import shutil
                    default_path = self.models_dir / 'classifier_best_v10.keras'
                    shutil.copy2(str(model_path), str(default_path))
                    logger.info(f"Updated active model at {default_path} with {self.state['backbone']} parameters.")
                except Exception as e:
                    logger.error(f"Error copying best model parameters: {e}")
                    
        except Exception as e:
            logger.error(f"Error in background training thread: {e}", exc_info=True)
            self.state['status'] = 'Error'
            self.state['error_message'] = str(e)
        finally:
            self.state['is_running'] = False
            self.emit_update()
