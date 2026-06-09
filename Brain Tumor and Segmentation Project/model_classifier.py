"""
================================================================================
model_classifier.py - UPGRADED v11.0 - HIGH-FIDELITY DYNAMIC CLASSIFICATION
================================================================================
Features:
1. Dynamic Backbone Selection:
   - ResNet50 + CBAM Attention
   - EfficientNetV2B0 (High Accuracy, Low Params)
   - DenseNet121 (Excellent for Medical Scans)
   - ResNet50V2 (Improved Gradients)
2. Focal Loss & Categorical Cross-Entropy support
3. CBAM Attention Layer (Channel & Spatial)
4. Advanced Augmentation Layer
5. Progressive Unfreezing Callback
"""

import logging
import numpy as np
from pathlib import Path
from typing import Dict, Tuple, Optional, List

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model, Input
from tensorflow.keras import backend as K

logger = logging.getLogger(__name__)

# ============================================================================
# PART 1: FOCAL LOSS
# ============================================================================

class FocalLoss(keras.losses.Loss):
    """
    Focal Loss for imbalanced classification
    FL = -α(1-pt)^γ log(pt)
    """
    def __init__(self, alpha=0.60, gamma=1.5, from_logits=False, name='focal_loss'):
        super().__init__(name=name)
        self.alpha = alpha
        self.gamma = gamma
        self.from_logits = from_logits
        
    def call(self, y_true, y_pred):
        y_true = tf.cast(y_true, tf.float32)
        y_pred = tf.cast(y_pred, tf.float32)
        
        if self.from_logits:
            y_pred = tf.nn.softmax(y_pred, axis=-1)
        
        epsilon = K.epsilon()
        y_pred = K.clip(y_pred, epsilon, 1.0 - epsilon)
        
        pt = tf.reduce_sum(y_true * y_pred, axis=-1)
        focal_weight = K.pow(1.0 - pt, self.gamma)
        ce = -tf.reduce_sum(y_true * K.log(y_pred), axis=-1)
        
        alpha_t = y_true[:, 1] * self.alpha + y_true[:, 0] * (1.0 - self.alpha)
        focal_loss = alpha_t * focal_weight * ce
        return K.mean(focal_loss)
    
    def get_config(self):
        config = super().get_config()
        config.update({
            'alpha': self.alpha,
            'gamma': self.gamma,
            'from_logits': self.from_logits
        })
        return config


# ============================================================================
# PART 2: CBAM ATTENTION MODULE
# ============================================================================

class CBAM_Attention(layers.Layer):
    """
    Convolutional Block Attention Module (CBAM)
    Channel Attention + Spatial Attention
    """
    def __init__(self, reduction_ratio=16, **kwargs):
        super(CBAM_Attention, self).__init__(**kwargs)
        self.reduction_ratio = reduction_ratio
        
    def build(self, input_shape):
        channel = input_shape[-1]
        self.shared_dense_1 = layers.Dense(
            max(1, channel // self.reduction_ratio),
            activation='relu',
            kernel_initializer='he_normal',
            use_bias=True
        )
        self.shared_dense_2 = layers.Dense(
            channel,
            kernel_initializer='he_normal',
            use_bias=True
        )
        self.conv_spatial = layers.Conv2D(
            filters=1,
            kernel_size=7,
            padding='same',
            activation='sigmoid',
            kernel_initializer='he_normal'
        )
        super(CBAM_Attention, self).build(input_shape)
    
    def channel_attention(self, input_feature):
        avg_pool = layers.GlobalAveragePooling2D()(input_feature)
        max_pool = layers.GlobalMaxPooling2D()(input_feature)
        
        avg_pool = self.shared_dense_1(avg_pool)
        avg_pool = self.shared_dense_2(avg_pool)
        
        max_pool = self.shared_dense_1(max_pool)
        max_pool = self.shared_dense_2(max_pool)
        
        cbam_feature = layers.Add()([avg_pool, max_pool])
        cbam_feature = layers.Activation('sigmoid')(cbam_feature)
        cbam_feature = layers.Reshape((1, 1, input_feature.shape[-1]))(cbam_feature)
        return layers.Multiply()([input_feature, cbam_feature])
    
    def spatial_attention(self, input_feature):
        avg_pool = K.mean(input_feature, axis=-1, keepdims=True)
        max_pool = K.max(input_feature, axis=-1, keepdims=True)
        concat = layers.Concatenate(axis=-1)([avg_pool, max_pool])
        cbam_feature = self.conv_spatial(concat)
        return layers.Multiply()([input_feature, cbam_feature])
    
    def call(self, input_feature):
        cbam_feature = self.channel_attention(input_feature)
        cbam_feature = self.spatial_attention(cbam_feature)
        return cbam_feature
    
    def get_config(self):
        config = super(CBAM_Attention, self).get_config()
        config.update({'reduction_ratio': self.reduction_ratio})
        return config


# ============================================================================
# PART 3: ADVANCED AUGMENTATION
# ============================================================================

class AdvancedAugmentation(layers.Layer):
    """Augmentation layers activated during training"""
    def __init__(self, training=True, **kwargs):
        super(AdvancedAugmentation, self).__init__(**kwargs)
        self.training = training
        self.random_flip = layers.RandomFlip("horizontal")
        self.random_rotation = layers.RandomRotation(0.1)
        self.random_zoom = layers.RandomZoom(0.1)
        self.random_contrast = layers.RandomContrast(0.15)
        self.random_brightness = layers.RandomBrightness(0.15)
    
    def call(self, images, training=None):
        if training is None:
            training = self.training
        if training:
            images = self.random_flip(images)
            images = self.random_rotation(images)
            images = self.random_zoom(images)
            images = self.random_contrast(images)
            images = self.random_brightness(images)
        return images


# ============================================================================
# PART 4: BRAIN TUMOR CLASSIFIER (v11.0 DYNAMIC CORES)
# ============================================================================

class BrainTumorClassifier_v10:
    """
    Brain Tumor Classifier v11.0 (maintaining class name for compatibility)
    Supports multiple backbone architectures and flexible unfreezing.
    """
    def __init__(self, input_shape=(256, 256, 3), num_classes=2, backbone_name='resnet50'):
        self.input_shape = input_shape
        self.num_classes = num_classes
        self.backbone_name = backbone_name.lower().strip()
        self.model = None
        self.base_model = None
        
        logger.info(f"Initialized BrainTumorClassifier v11.0")
        logger.info(f"   Backbone: {self.backbone_name}")
        logger.info(f"   Input shape: {input_shape}")
        
    def build_model(self, freeze_backbone=True, use_augmentation=True):
        logger.info(f"🔨 BUILDING MODEL WITH BACKBONE: {self.backbone_name}")
        inputs = Input(shape=self.input_shape)
        
        if use_augmentation:
            x = AdvancedAugmentation(training=True)(inputs)
        else:
            x = inputs
            
        # Select Backbone
        if self.backbone_name == 'efficientnet_v2_b0':
            self.base_model = tf.keras.applications.EfficientNetV2B0(
                input_shape=self.input_shape,
                include_top=False,
                weights='imagenet'
            )
        elif self.backbone_name == 'densenet121':
            self.base_model = tf.keras.applications.DenseNet121(
                input_shape=self.input_shape,
                include_top=False,
                weights='imagenet'
            )
        elif self.backbone_name == 'resnet50_v2':
            self.base_model = tf.keras.applications.ResNet50V2(
                input_shape=self.input_shape,
                include_top=False,
                weights='imagenet'
            )
        else: # Default resnet50
            self.backbone_name = 'resnet50'
            self.base_model = tf.keras.applications.ResNet50(
                input_shape=self.input_shape,
                include_top=False,
                weights='imagenet'
            )
            
        if freeze_backbone:
            self.base_model.trainable = False
            logger.info("Backbone frozen initially.")
            
        x = self.base_model(x, training=False if freeze_backbone else True)
        
        # Add Attention (CBAM)
        x = CBAM_Attention(reduction_ratio=16)(x)
        
        # Classification Head
        x = layers.GlobalAveragePooling2D()(x)
        
        # Fully Connected layers with L2 Regularization & Batch Normalization
        x = layers.Dense(256, kernel_regularizer=keras.regularizers.l2(0.0005))(x)
        x = layers.BatchNormalization()(x)
        x = layers.Activation('relu')(x)
        x = layers.Dropout(0.3)(x)
        
        x = layers.Dense(128, kernel_regularizer=keras.regularizers.l2(0.0005))(x)
        x = layers.BatchNormalization()(x)
        x = layers.Activation('relu')(x)
        x = layers.Dropout(0.2)(x)
        
        outputs = layers.Dense(
            self.num_classes,
            activation='softmax',
            kernel_initializer='glorot_uniform'
        )(x)
        
        self.model = Model(inputs=inputs, outputs=outputs, name=f'BrainTumorClassifier_{self.backbone_name}')
        logger.info(f"Model constructed. Total params: {self.model.count_params():,}")
        return self.model
        
    def compile_model(self, learning_rate=1e-4, use_focal_loss=True, class_weights=None):
        optimizer = keras.optimizers.Adam(learning_rate=learning_rate, epsilon=1e-7)
        
        if use_focal_loss:
            loss = FocalLoss(alpha=0.60, gamma=1.5, from_logits=False)
            logger.info("Using Focal Loss (alpha=0.60, gamma=1.5)")
        else:
            loss = keras.losses.CategoricalCrossentropy()
            logger.info("Using Categorical Cross-Entropy Loss")
            
        metrics = [
            keras.metrics.CategoricalAccuracy(name='accuracy'),
            keras.metrics.Precision(name='precision'),
            keras.metrics.Recall(name='recall'),
            keras.metrics.AUC(name='auc', curve='ROC')
        ]
        
        self.model.compile(
            optimizer=optimizer,
            loss=loss,
            metrics=metrics,
            weighted_metrics=[] if class_weights is None else ['accuracy']
        )
        logger.info("Model compiled successfully.")
        
    def unfreeze_backbone(self, num_layers=30):
        if self.base_model is not None:
            self.base_model.trainable = True
            # Freeze early layers, train only last few layers
            for layer in self.base_model.layers[:-num_layers]:
                layer.trainable = False
            trainable_params = sum([K.count_params(w) for w in self.model.trainable_weights])
            logger.info(f"Unfrozen last {num_layers} layers of the {self.backbone_name} backbone.")
            logger.info(f"New trainable parameters count: {trainable_params:,}")
            
    def summary(self):
        if self.model:
            self.model.summary()


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def calculate_class_weights(df, mask_column='mask'):
    from sklearn.utils.class_weight import compute_class_weight
    classes = np.unique(df[mask_column])
    weights = compute_class_weight(
        class_weight='balanced',
        classes=classes,
        y=df[mask_column]
    )
    class_weight_dict = {i: float(weight) for i, weight in enumerate(weights)}
    logger.info(f"Calculated class weights: {class_weight_dict}")
    return class_weight_dict


# ============================================================================
# PROGRESSIVE UNFREEZING CALLBACK
# ============================================================================

class ProgressiveUnfreezingCallback(keras.callbacks.Callback):
    def __init__(self, classifier_obj, unfreeze_epoch=10, num_layers=30, new_lr=1e-5):
        super().__init__()
        self.classifier_obj = classifier_obj
        self.unfreeze_epoch = unfreeze_epoch
        self.num_layers = num_layers
        self.new_lr = new_lr
        
    def on_epoch_begin(self, epoch, logs=None):
        if epoch == self.unfreeze_epoch:
            logger.info(f"--- Unfreezing Backbone at Epoch {epoch} ---")
            self.classifier_obj.unfreeze_backbone(num_layers=self.num_layers)
            K.set_value(self.model.optimizer.learning_rate, self.new_lr)
            logger.info(f"Adjusted learning rate to {self.new_lr} for fine-tuning.")