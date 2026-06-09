"""
model_segmentation.py - ResUNet Segmentation Model
Version 2.0 - With Combined Loss Function

Features:
- ResUNet architecture
- Combined loss (Focal Tversky + Dice)
- Proper metrics (Dice, IoU)
"""

import logging
from pathlib import Path
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
import tensorflow.keras.backend as K

logger = logging.getLogger(__name__)


# ==============================================================================
# LOSS FUNCTIONS AND METRICS
# ==============================================================================

def dice_coefficient(y_true, y_pred, smooth=1e-6):
    """
    Dice coefficient for similarity measurement
    Used as part of combined loss function
    
    Args:
        y_true: Ground truth masks
        y_pred: Predicted masks
        smooth: Smoothing factor to avoid division by zero
    
    Returns:
        Dice coefficient score (0 to 1, higher is better)
    """
    y_true_f = K.flatten(y_true)
    y_pred_f = K.flatten(y_pred)
    
    intersection = K.sum(y_true_f * y_pred_f)
    union = K.sum(y_true_f) + K.sum(y_pred_f)
    
    dice = (2. * intersection + smooth) / (union + smooth)
    
    return dice


def focal_tversky_loss(y_true, y_pred, alpha=0.7, beta=0.3, gamma=0.5):
    """
    Focal Tversky Loss with REDUCED gamma parameter
    
    CRITICAL CHANGE: gamma = 0.5 (reduced from 0.75)
    
    Why this matters:
    - gamma=0.75 was too aggressive for early training
    - Model couldn't learn initial patterns
    - gamma=0.5 provides better balance
    
    Args:
        y_true: Ground truth masks
        y_pred: Predicted masks
        alpha: Weight for false negatives (0.7 = prioritize recall)
        beta: Weight for false positives (0.3 = less penalty)
        gamma: Focusing parameter (0.5 = moderate focus on hard examples)
    
    Returns:
        Focal Tversky loss value
    """
    smooth = 1e-6
    
    # Flatten tensors
    y_true_f = K.flatten(y_true)
    y_pred_f = K.flatten(y_pred)
    
    # Calculate components
    TP = K.sum(y_true_f * y_pred_f)
    FN = K.sum(y_true_f * (1 - y_pred_f))
    FP = K.sum((1 - y_true_f) * y_pred_f)
    
    # Tversky index
    tversky_index = (TP + smooth) / (TP + alpha*FN + beta*FP + smooth)
    
    # Apply focal component
    focal_tversky = K.pow((1 - tversky_index), gamma)
    
    return focal_tversky


def combined_loss(y_true, y_pred):
    """
    Combined loss: Focal Tversky + Dice Loss
    
    This is THE CRITICAL FIX for IoU 0.005 problem!
    
    Why this works:
    1. Focal Tversky ALONE → Model predicts "all background"
       - Loss minimized by never predicting tumor
       - Result: IoU ≈ 0.005 (stuck!)
    
    2. Dice Loss ADDED → Forces model to predict SOME tumor
       - Penalizes imbalance between TP, FP, FN
       - Prevents trivial "all background" solution
    
    3. Weighted Combination (70% FT + 30% Dice)
       - FT focuses on hard examples (boundaries)
       - Dice provides stable gradient signal
       - Balance prevents both underfitting and trivial solutions
    
    Args:
        y_true: Ground truth masks
        y_pred: Predicted masks
    
    Returns:
        Combined loss value
    """
    # Focal Tversky component (70% weight)
    ft_loss = focal_tversky_loss(y_true, y_pred, 
                                  alpha=0.7, beta=0.3, gamma=0.5)
    
    # Dice loss component (30% weight)
    dice_score = dice_coefficient(y_true, y_pred)
    dice_loss = 1 - dice_score  # Convert to loss (minimize)
    
    # Weighted combination
    total_loss = 0.7 * ft_loss + 0.3 * dice_loss
    
    return total_loss


def dice_metric(y_true, y_pred):
    """Dice coefficient as a metric (for monitoring during training)"""
    return dice_coefficient(y_true, y_pred)


def iou_metric(y_true, y_pred, smooth=1e-6):
    """IoU (Intersection over Union) metric"""
    y_true_f = K.flatten(y_true)
    y_pred_f = K.flatten(y_pred)
    
    intersection = K.sum(y_true_f * y_pred_f)
    union = K.sum(y_true_f) + K.sum(y_pred_f) - intersection
    
    iou = (intersection + smooth) / (union + smooth)
    
    return iou


# ==============================================================================
# RESUNET MODEL
# ==============================================================================

class ResUNetSegmentation:
    """
    ResUNet segmentation model with combined loss function
    
    Features:
    - Residual connections for better gradient flow
    - U-Net architecture for spatial information preservation
    - Combined loss function (Focal Tversky + Dice)
    - Proper metrics tracking (Dice, IoU)
    """
    
    def __init__(self, input_shape=(256, 256, 1)):
        """
        Initialize ResUNet model
        
        Args:
            input_shape: Input image shape (height, width, channels)
                        For grayscale MRI: (256, 256, 1)
        """
        self.input_shape = input_shape
        self.model = None
        logger.info(f"Initialized ResUNet with input shape: {input_shape}")
    
    def residual_block(self, x, filters, kernel_size=3):
        """
        Residual block with skip connection
        
        Args:
            x: Input tensor
            filters: Number of filters
            kernel_size: Convolution kernel size
        
        Returns:
            Output tensor with residual connection
        """
        # Main path
        fx = layers.Conv2D(filters, kernel_size, padding='same')(x)
        fx = layers.BatchNormalization()(fx)
        fx = layers.Activation('relu')(fx)
        fx = layers.Conv2D(filters, kernel_size, padding='same')(fx)
        fx = layers.BatchNormalization()(fx)
        
        # Skip connection
        if x.shape[-1] != filters:
            x = layers.Conv2D(filters, 1, padding='same')(x)
        
        # Add and activate
        out = layers.Add()([x, fx])
        out = layers.Activation('relu')(out)
        
        return out
    
    def build_model(self):
        """Build ResUNet segmentation model"""
        logger.info("Building ResUNet segmentation model...")
        
        inputs = keras.Input(shape=self.input_shape)
        
        # Encoder (downsampling path)
        # Level 1
        conv1 = self.residual_block(inputs, 64)
        pool1 = layers.MaxPooling2D(pool_size=(2, 2))(conv1)
        
        # Level 2
        conv2 = self.residual_block(pool1, 128)
        pool2 = layers.MaxPooling2D(pool_size=(2, 2))(conv2)
        
        # Level 3
        conv3 = self.residual_block(pool2, 256)
        pool3 = layers.MaxPooling2D(pool_size=(2, 2))(conv3)
        
        # Level 4
        conv4 = self.residual_block(pool3, 512)
        pool4 = layers.MaxPooling2D(pool_size=(2, 2))(conv4)
        
        # Bottleneck
        bottleneck = self.residual_block(pool4, 1024)
        
        # Decoder (upsampling path)
        # Level 4
        up4 = layers.UpSampling2D(size=(2, 2))(bottleneck)
        up4 = layers.concatenate([up4, conv4], axis=-1)
        conv5 = self.residual_block(up4, 512)
        
        # Level 3
        up3 = layers.UpSampling2D(size=(2, 2))(conv5)
        up3 = layers.concatenate([up3, conv3], axis=-1)
        conv6 = self.residual_block(up3, 256)
        
        # Level 2
        up2 = layers.UpSampling2D(size=(2, 2))(conv6)
        up2 = layers.concatenate([up2, conv2], axis=-1)
        conv7 = self.residual_block(up2, 128)
        
        # Level 1
        up1 = layers.UpSampling2D(size=(2, 2))(conv7)
        up1 = layers.concatenate([up1, conv1], axis=-1)
        conv8 = self.residual_block(up1, 64)
        
        # Output layer
        outputs = layers.Conv2D(1, (1, 1), activation='sigmoid')(conv8)
        
        # Create model
        self.model = keras.Model(inputs=inputs, outputs=outputs, name='ResUNet')
        
        logger.info("✅ ResUNet model built successfully")
        logger.info(f"   Total parameters: {self.model.count_params():,}")
        
        return self.model
    
    def compile_model(self, learning_rate=0.0001, epsilon=1e-7):
        """
        Compile model with combined loss function
        
        CRITICAL CHANGES:
        1. Learning rate: 0.0001 (reduced from 0.001)
        2. Loss function: combined_loss (was focal_tversky_loss)
        3. Metrics: dice_metric, iou_metric (track correct metrics!)
        
        Args:
            learning_rate: 0.0001 (reduced for stability)
            epsilon: Small constant for numerical stability
        """
        optimizer = keras.optimizers.Adam(
            learning_rate=learning_rate,
            beta_1=0.9,
            beta_2=0.999,
            epsilon=epsilon
        )
        
        self.model.compile(
            optimizer=optimizer,
            loss=combined_loss,  # CRITICAL CHANGE!
            metrics=[
                'accuracy',     # Keep for compatibility, but IGNORE this
                dice_metric,    # WATCH THIS METRIC!
                iou_metric      # AND THIS ONE!
            ]
        )
        
        logger.info("✅ Model compiled with:")
        logger.info(f"   Loss: Combined (Focal Tversky + Dice)")
        logger.info(f"   Learning Rate: {learning_rate}")
        logger.info(f"   Metrics: Accuracy (ignore), Dice, IoU")
    
    def summary(self):
        """Print model summary"""
        if self.model is not None:
            self.model.summary()
        else:
            logger.warning("Model not built yet. Call build_model() first.")
    
    def get_callbacks(self, checkpoint_path):
        """
        Get training callbacks
        
        Args:
            checkpoint_path: Path to save best model
        
        Returns:
            List of callbacks
        """
        # Convert to Path object
        ckpt_path = Path(checkpoint_path)
        ckpt_path.parent.mkdir(parents=True, exist_ok=True)
        
        # If directory was passed, fix it
        if ckpt_path.is_dir():
            ckpt_path = ckpt_path / "segmentation_best.keras"
        
        checkpoint_file = str(ckpt_path)
        logger.info(f"Checkpoint will be saved to: {checkpoint_file}")
        
        callbacks = [
            ModelCheckpoint(
                filepath=checkpoint_file,
                monitor='val_loss',
                mode='min',
                save_best_only=True,
                save_weights_only=False,
                verbose=1
            ),
            EarlyStopping(
                monitor='val_loss',
                mode='min',
                patience=30,  # Increased from 10
                restore_best_weights=True,
                verbose=1
            ),
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=10,  # Increased from 5
                min_lr=1e-7,
                verbose=1
            )
        ]
        
        return callbacks


# ==============================================================================
# STANDALONE FUNCTIONS FOR COMPATIBILITY
# ==============================================================================

# Legacy functions for backward compatibility
def tversky(y_true, y_pred, smooth=1):
    """Tversky Index Loss (legacy)"""
    y_pred = tf.cast(y_pred, tf.float32)
    y_true = tf.cast(y_true, tf.float32)
    
    intersection = tf.reduce_sum(y_true * y_pred)
    false_pos = tf.reduce_sum(y_pred * (1 - y_true))
    false_neg = tf.reduce_sum((1 - y_pred) * y_true)
    
    alpha = 0.5
    beta = 0.5
    
    tversky_index = (intersection + smooth) / (intersection + alpha * false_pos + beta * false_neg + smooth)
    
    return 1.0 - tversky_index


def focal_tversky(y_true, y_pred, smooth=1, gamma=0.75):
    """Focal Tversky Loss (legacy - DO NOT USE, use combined_loss instead)"""
    tv = tversky(y_true, y_pred, smooth=smooth)
    return K.pow((1.0 - tv), gamma)


# ==============================================================================
# USAGE EXAMPLE
# ==============================================================================

if __name__ == '__main__':
    """
    Example usage of ResUNet model
    """
    
    # Create model
    model = ResUNetSegmentation(input_shape=(256, 256, 1))
    
    # Build architecture
    model.build_model()
    
    # Compile with combined loss
    model.compile_model(learning_rate=0.0001)
    
    # Print summary
    model.summary()
    
    # Get callbacks
    callbacks = model.get_callbacks('models/segmentation_best.keras')
    
    print("\n✅ Model ready for training!")
    print("Use this model in your training pipeline.")