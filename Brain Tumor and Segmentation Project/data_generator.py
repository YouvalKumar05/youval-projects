"""
data_generator.py - COMPLETE FIXED VERSION
Includes BOTH ClassificationDataGenerator AND SegmentationDataGenerator

Features:
- ClassificationDataGenerator for tumor detection
- SegmentationDataGenerator for tumor localization
- Fixed preprocessing (INTER_NEAREST for masks)
- Data augmentation support
"""

import cv2
import numpy as np
from tensorflow import keras
from scipy.ndimage import rotate as scipy_rotate
import logging

logger = logging.getLogger(__name__)


# ==============================================================================
# CLASSIFICATION DATA GENERATOR
# ==============================================================================

class ClassificationDataGenerator(keras.utils.Sequence):
    """
    Data generator for classification (tumor detection)
    Outputs: (images, labels) where labels are integers {0, 1}
    """
    
    def __init__(self, df, data_processor, batch_size=16, 
                 target_size=(256, 256), is_training=False):
        """
        Args:
            df: DataFrame with 'image_path' and 'has_mask' columns
            data_processor: DataProcessor instance
            batch_size: Batch size
            target_size: Output image size
            is_training: Enable data augmentation if True
        """
        self.df = df.reset_index(drop=True)
        self.data_processor = data_processor
        self.batch_size = batch_size
        self.target_size = target_size
        self.is_training = is_training
        self.indexes = np.arange(len(self.df))
        
        if self.is_training:
            np.random.shuffle(self.indexes)
        
        logger.info(f"ClassificationDataGenerator: {len(self.df)} samples, "
                   f"batch_size={batch_size}, training={is_training}")
    
    def __len__(self):
        """Number of batches per epoch"""
        return max(1, int(np.ceil(len(self.df) / self.batch_size)))
    
    def __getitem__(self, index):
        """Generate one batch of data"""
        # Get batch indices
        batch_indexes = self.indexes[
            index * self.batch_size:(index + 1) * self.batch_size
        ]
        
        batch_images = []
        batch_labels = []
        
        for idx in batch_indexes:
            img_path = self.df.iloc[idx]['image_path']
            label = self.df.iloc[idx]['has_mask']  # 0 or 1
            
            # Load and preprocess image
            img = self.load_classification_image(img_path)
            
            batch_images.append(img)
            batch_labels.append(label)
        
        return np.array(batch_images), np.array(batch_labels, dtype=np.float32)
    
    def load_classification_image(self, image_path):
        """
        Load and preprocess image for classification
        
        Returns:
            RGB image (256, 256, 3) normalized to [0, 1]
        """
        # Load as grayscale
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        
        if img is None:
            raise ValueError(f"Could not load: {image_path}")
        
        # Normalize
        img = img.astype(np.float32)
        img_min, img_max = img.min(), img.max()
        if img_max > img_min:
            img = (img - img_min) / (img_max - img_min + 1e-8)
        else:
            img = np.zeros_like(img, dtype=np.float32)
        
        # Resize
        img = cv2.resize(img, self.target_size, interpolation=cv2.INTER_LINEAR)
        
        # Convert to RGB (duplicate channels)
        img_rgb = np.stack([img, img, img], axis=-1)
        
        return img_rgb
    
    def on_epoch_end(self):
        """Shuffle indexes after each epoch"""
        if self.is_training:
            np.random.shuffle(self.indexes)


# ==============================================================================
# SEGMENTATION DATA GENERATOR
# ==============================================================================

class SegmentationDataGenerator(keras.utils.Sequence):
    """
    Data generator for segmentation (tumor localization)
    Outputs: (images, masks) both grayscale (256, 256, 1)
    
    CRITICAL FIXES:
    - INTER_NEAREST for mask resizing (preserves binary values)
    - Explicit binarization (ensures {0, 1} only)
    - Data augmentation support
    """
    
    def __init__(self, df, data_processor, batch_size=16,
                 target_size=(256, 256), is_training=False):
        """
        Args:
            df: DataFrame with 'image_path' and 'mask_path' columns
            data_processor: DataProcessor instance
            batch_size: Batch size
            target_size: Output size
            is_training: Enable augmentation if True
        """
        self.df = df.reset_index(drop=True)
        self.data_processor = data_processor
        self.batch_size = batch_size
        self.target_size = target_size
        self.is_training = is_training
        self.indexes = np.arange(len(self.df))
        
        if self.is_training:
            np.random.shuffle(self.indexes)
        
        logger.info(f"SegmentationDataGenerator: {len(self.df)} samples, "
                   f"batch_size={batch_size}, training={is_training}")
    
    def __len__(self):
        """Number of batches per epoch"""
        return max(1, int(np.ceil(len(self.df) / self.batch_size)))
    
    def __getitem__(self, index):
        """Generate one batch of data"""
        batch_indexes = self.indexes[
            index * self.batch_size:(index + 1) * self.batch_size
        ]
        
        batch_images = []
        batch_masks = []
        
        for idx in batch_indexes:
            img_path = self.df.iloc[idx]['image_path']
            mask_path = self.df.iloc[idx]['mask_path']
            
            # Load and preprocess (FIXED!)
            img, mask = self.load_and_preprocess(img_path, mask_path)
            
            # Apply augmentation if training (NEW!)
            if self.is_training:
                img, mask = self.augment(img, mask)
            
            batch_images.append(img)
            batch_masks.append(mask)
        
        return np.array(batch_images), np.array(batch_masks)
    
    def load_and_preprocess(self, image_path, mask_path):
        """
        🔥 CRITICAL FIX - This was causing IoU 0.005 problem!
        
        FIXED:
        - Use cv2.INTER_NEAREST for masks → Binary values only!
        - Normalize BEFORE resize → Preserves intensity distribution
        - Explicit binarization → Ensures {0, 1}
        
        Returns:
            tuple: (preprocessed_image, binary_mask)
        """
        # Load images as grayscale
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        
        # Handle None (corrupted files)
        if img is None or mask is None:
            raise ValueError(f"Could not load: {image_path} or {mask_path}")
        
        # 1. INTENSITY NORMALIZATION (BEFORE resize!)
        img = img.astype(np.float32)
        img_min = img.min()
        img_max = img.max()
        if img_max > img_min:
            img = (img - img_min) / (img_max - img_min + 1e-8)
        else:
            img = np.zeros_like(img, dtype=np.float32)
        
        # 2. RESIZE with CORRECT interpolation
        img = cv2.resize(
            img,
            self.target_size,
            interpolation=cv2.INTER_LINEAR  # OK for images
        )
        
        mask = cv2.resize(
            mask,
            self.target_size,
            interpolation=cv2.INTER_NEAREST  # 🔥 CRITICAL for masks!
        )
        
        # 3. BINARIZE mask explicitly
        mask = mask.astype(np.float32)
        mask = (mask > 127).astype(np.float32)  # Threshold at midpoint
        
        # 4. Add channel dimension
        img = np.expand_dims(img, axis=-1)
        mask = np.expand_dims(mask, axis=-1)
        
        # 5. Final validation
        assert img.shape == self.target_size + (1,), \
            f"Image shape mismatch: {img.shape} vs {self.target_size + (1,)}"
        assert mask.shape == self.target_size + (1,), \
            f"Mask shape mismatch: {mask.shape} vs {self.target_size + (1,)}"
        assert np.all((mask == 0) | (mask == 1)), \
            f"Mask contains non-binary values: {np.unique(mask)}"
        
        return img, mask
    
    def augment(self, image, mask):
        """
        Apply data augmentation during training
        
        Techniques:
        - Random rotation: ±15 degrees
        - Random horizontal flip: 50% probability
        - Random brightness: ±10%
        - Random contrast: ±10%
        """
        # Random rotation ±15 degrees
        if np.random.rand() > 0.5:
            angle = np.random.uniform(-15, 15)
            image = self.rotate_image(image, angle)
            mask = self.rotate_image(mask, angle, order=0)  # order=0 for masks!
        
        # Random horizontal flip
        if np.random.rand() > 0.5:
            image = np.fliplr(image)
            mask = np.fliplr(mask)
        
        # Random brightness adjustment (±10%)
        if np.random.rand() > 0.5:
            factor = np.random.uniform(0.9, 1.1)
            image = np.clip(image * factor, 0, 1)
        
        # Random contrast adjustment (±10%)
        if np.random.rand() > 0.5:
            mean = np.mean(image)
            image = image - mean
            image = image * np.random.uniform(0.9, 1.1)
            image = image + mean
            image = np.clip(image, 0, 1)
        
        # Re-binarize mask after augmentation (safety check)
        mask = (mask > 0.5).astype(np.float32)
        
        return image, mask
    
    def rotate_image(self, image, angle, order=1):
        """
        Rotate image by given angle
        
        Args:
            image: Input image
            angle: Rotation angle in degrees
            order: Interpolation order
                   1 = bilinear (for images)
                   0 = nearest neighbor (for masks)
        """
        # Remove channel dimension for rotation
        img_2d = np.squeeze(image, axis=-1)
        
        # Rotate
        rotated = scipy_rotate(
            img_2d,
            angle,
            reshape=False,
            order=order,
            mode='constant',
            cval=0
        )
        
        # Restore channel dimension
        rotated = np.expand_dims(rotated, axis=-1)
        
        return rotated
    
    def on_epoch_end(self):
        """Shuffle indexes after each epoch"""
        if self.is_training:
            np.random.shuffle(self.indexes)


# ==============================================================================
# USAGE EXAMPLE
# ==============================================================================

if __name__ == '__main__':
    """
    Example usage
    """
    print("✅ data_generator.py loaded successfully")
    print("Contains:")
    print("  - ClassificationDataGenerator")
    print("  - SegmentationDataGenerator")
    