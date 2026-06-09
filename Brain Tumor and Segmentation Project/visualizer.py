"""
visualizer.py - Visualization module for prediction results
Displays MRI scans with ground truth and predicted tumor segmentation
"""

import numpy as np
import matplotlib.pyplot as plt
import cv2
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class SegmentationVisualizer:
    """
    Visualizes segmentation predictions alongside ground truth
    Shows MRI scan, ground truth mask, predicted mask, and overlays
    """
    
    def __init__(self, save_dir='results/visualizations'):
        self.save_dir = Path(save_dir)
        self.save_dir.mkdir(parents=True, exist_ok=True)
    
    def visualize_predictions(self, model, generator, num_samples=10, 
                            split_name='test', threshold=0.5):
        """
        Generate visualization of predictions
        
        Args:
            model: Trained segmentation model
            generator: Data generator (test/validation set)
            num_samples: Number of samples to visualize
            split_name: Dataset split name ('test', 'val', etc.)
            threshold: Threshold for binary prediction (default 0.5)
        
        Returns:
            dict: Metrics for visualized samples
        """
        logger.info(f"\n{'='*80}")
        logger.info(f"GENERATING VISUALIZATIONS - {split_name.upper()} SET")
        logger.info(f"{'='*80}")
        
        # Collect samples
        samples_collected = 0
        all_images = []
        all_masks = []
        all_predictions = []
        all_dice_scores = []
        all_iou_scores = []
        
        for batch_idx in range(len(generator)):
            if samples_collected >= num_samples:
                break
            
            # Get batch
            X_batch, y_batch = generator[batch_idx]
            
            # Predict
            y_pred = model.predict(X_batch, verbose=0)
            
            # Process each sample in batch
            for i in range(len(X_batch)):
                if samples_collected >= num_samples:
                    break
                
                image = X_batch[i]
                mask_true = y_batch[i]
                mask_pred = (y_pred[i] > threshold).astype(np.float32)
                
                # Calculate metrics
                dice = self._calculate_dice(mask_true, mask_pred)
                iou = self._calculate_iou(mask_true, mask_pred)
                
                all_images.append(image)
                all_masks.append(mask_true)
                all_predictions.append(mask_pred)
                all_dice_scores.append(dice)
                all_iou_scores.append(iou)
                
                samples_collected += 1
        
        # Create visualizations
        logger.info(f"Creating visualizations for {samples_collected} samples...")
        
        # Individual sample visualizations
        for idx in range(samples_collected):
            self._visualize_single_sample(
                image=all_images[idx],
                mask_true=all_masks[idx],
                mask_pred=all_predictions[idx],
                dice=all_dice_scores[idx],
                iou=all_iou_scores[idx],
                sample_idx=idx,
                split_name=split_name
            )
        
        # Create grid visualization
        self._visualize_grid(
            images=all_images,
            masks_true=all_masks,
            masks_pred=all_predictions,
            dice_scores=all_dice_scores,
            iou_scores=all_iou_scores,
            split_name=split_name
        )
        
        # Summary statistics
        results = {
            'num_samples': samples_collected,
            'mean_dice': float(np.mean(all_dice_scores)),
            'std_dice': float(np.std(all_dice_scores)),
            'mean_iou': float(np.mean(all_iou_scores)),
            'std_iou': float(np.std(all_iou_scores)),
            'min_dice': float(np.min(all_dice_scores)),
            'max_dice': float(np.max(all_dice_scores)),
        }
        
        logger.info(f"\n📊 Visualization Metrics:")
        logger.info(f"   Samples visualized: {results['num_samples']}")
        logger.info(f"   Mean Dice: {results['mean_dice']:.4f} ± {results['std_dice']:.4f}")
        logger.info(f"   Mean IoU:  {results['mean_iou']:.4f} ± {results['std_iou']:.4f}")
        logger.info(f"   Dice Range: [{results['min_dice']:.4f}, {results['max_dice']:.4f}]")
        logger.info(f"\n✅ Visualizations saved to: {self.save_dir}/")
        
        return results
    
    def _visualize_single_sample(self, image, mask_true, mask_pred, 
                                dice, iou, sample_idx, split_name):
        """
        Create visualization for a single sample
        Shows: MRI | Ground Truth | Prediction | MRI+GT Overlay | MRI+Pred Overlay
        """
        fig, axes = plt.subplots(2, 3, figsize=(15, 10))
        
        # Remove channel dimension for display
        img = np.squeeze(image, axis=-1)
        gt = np.squeeze(mask_true, axis=-1)
        pred = np.squeeze(mask_pred, axis=-1)
        
        # Row 1: Original views
        # MRI scan
        axes[0, 0].imshow(img, cmap='gray')
        axes[0, 0].set_title('MRI Scan', fontsize=12, fontweight='bold')
        axes[0, 0].axis('off')
        
        # Ground truth mask
        axes[0, 1].imshow(gt, cmap='gray')
        axes[0, 1].set_title('Ground Truth Mask', fontsize=12, fontweight='bold')
        axes[0, 1].axis('off')
        
        # Predicted mask
        axes[0, 2].imshow(pred, cmap='gray')
        axes[0, 2].set_title('AI Predicted Mask', fontsize=12, fontweight='bold')
        axes[0, 2].axis('off')
        
        # Row 2: Overlays
        # MRI + Ground truth overlay
        axes[1, 0].imshow(img, cmap='gray')
        axes[1, 0].imshow(gt, alpha=0.5, cmap='Reds')
        axes[1, 0].set_title('MRI + Ground Truth\nOverlay', 
                            fontsize=12, fontweight='bold')
        axes[1, 0].axis('off')
        
        # MRI + Prediction overlay
        axes[1, 1].imshow(img, cmap='gray')
        axes[1, 1].imshow(pred, alpha=0.5, cmap='Blues')
        axes[1, 1].set_title('MRI + AI Prediction\nOverlay', 
                            fontsize=12, fontweight='bold')
        axes[1, 1].axis('off')
        
        # Comparison: GT vs Prediction
        # Green = True Positive, Red = False Positive, Blue = False Negative
        comparison = np.zeros((*img.shape, 3))
        tp = (gt == 1) & (pred == 1)  # True Positive - Green
        fp = (gt == 0) & (pred == 1)  # False Positive - Red
        fn = (gt == 1) & (pred == 0)  # False Negative - Blue
        
        comparison[tp, 1] = 1.0  # Green channel
        comparison[fp, 0] = 1.0  # Red channel
        comparison[fn, 2] = 1.0  # Blue channel
        
        axes[1, 2].imshow(img, cmap='gray')
        axes[1, 2].imshow(comparison, alpha=0.6)
        axes[1, 2].set_title(f'Comparison\n(Green=Match, Red=FP, Blue=FN)', 
                            fontsize=12, fontweight='bold')
        axes[1, 2].axis('off')
        
        # Overall title with metrics
        fig.suptitle(
            f'Sample {sample_idx + 1} ({split_name.upper()} Set) | '
            f'Dice: {dice:.4f} | IoU: {iou:.4f}',
            fontsize=14, fontweight='bold', y=0.98
        )
        
        plt.tight_layout(rect=[0, 0, 1, 0.96])
        
        # Save figure
        save_path = self.save_dir / f'{split_name}_sample_{sample_idx+1:02d}.png'
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        logger.info(f"   ✅ Sample {sample_idx+1}: Dice={dice:.4f}, IoU={iou:.4f}")
    
    def _visualize_grid(self, images, masks_true, masks_pred, 
                       dice_scores, iou_scores, split_name):
        """
        Create grid visualization of all samples
        Compact view for quick comparison
        """
        num_samples = len(images)
        cols = 5  # 5 columns per row
        rows = int(np.ceil(num_samples / cols))
        
        fig, axes = plt.subplots(rows, cols, figsize=(20, rows * 4))
        
        if rows == 1:
            axes = axes.reshape(1, -1)
        
        for idx in range(num_samples):
            row = idx // cols
            col = idx % cols
            ax = axes[row, col]
            
            # Get data
            img = np.squeeze(images[idx], axis=-1)
            pred = np.squeeze(masks_pred[idx], axis=-1)
            gt = np.squeeze(masks_true[idx], axis=-1)
            
            # Display MRI with both GT (red) and prediction (blue) overlays
            ax.imshow(img, cmap='gray')
            ax.imshow(gt, alpha=0.3, cmap='Reds')
            ax.imshow(pred, alpha=0.3, cmap='Blues')
            
            # Title with metrics
            dice = dice_scores[idx]
            iou = iou_scores[idx]
            ax.set_title(f'#{idx+1}\nDice: {dice:.3f}\nIoU: {iou:.3f}',
                        fontsize=9)
            ax.axis('off')
        
        # Hide unused subplots
        for idx in range(num_samples, rows * cols):
            row = idx // cols
            col = idx % cols
            axes[row, col].axis('off')
        
        fig.suptitle(
            f'Grid Visualization - {split_name.upper()} Set\n'
            f'(Red=Ground Truth, Blue=AI Prediction)',
            fontsize=14, fontweight='bold'
        )
        
        plt.tight_layout(rect=[0, 0, 1, 0.96])
        
        # Save
        save_path = self.save_dir / f'{split_name}_grid_all_samples.png'
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        logger.info(f"   ✅ Grid visualization saved: {save_path.name}")
    
    def _calculate_dice(self, y_true, y_pred, smooth=1e-6):
        """Calculate Dice coefficient"""
        y_true_f = y_true.flatten()
        y_pred_f = y_pred.flatten()
        
        intersection = np.sum(y_true_f * y_pred_f)
        union = np.sum(y_true_f) + np.sum(y_pred_f)
        
        dice = (2. * intersection + smooth) / (union + smooth)
        return dice
    
    def _calculate_iou(self, y_true, y_pred, smooth=1e-6):
        """Calculate IoU (Intersection over Union)"""
        y_true_f = y_true.flatten()
        y_pred_f = y_pred.flatten()
        
        intersection = np.sum(y_true_f * y_pred_f)
        union = np.sum(y_true_f) + np.sum(y_pred_f) - intersection
        
        iou = (intersection + smooth) / (union + smooth)
        return iou


def visualize_training_history(history, save_dir='results'):
    """
    Plot training history (loss, dice, IoU curves)
    
    Args:
        history: Training history dictionary
        save_dir: Directory to save plots
    """
    save_dir = Path(save_dir)
    save_dir.mkdir(parents=True, exist_ok=True)
    
    # Check what metrics are available
    available_metrics = []
    if 'loss' in history and history['loss']:
        available_metrics.append(('loss', 'Loss'))
    if 'dice' in history and history['dice']:
        available_metrics.append(('dice', 'Dice Coefficient'))
    if 'iou' in history and history['iou']:
        available_metrics.append(('iou', 'IoU (Jaccard)'))
    
    if not available_metrics:
        logger.warning("No metrics found in training history")
        return
    
    # Create subplots
    num_metrics = len(available_metrics)
    fig, axes = plt.subplots(1, num_metrics, figsize=(6*num_metrics, 5))
    
    if num_metrics == 1:
        axes = [axes]
    
    for idx, (metric_key, metric_name) in enumerate(available_metrics):
        ax = axes[idx]
        
        # Plot training metric
        epochs = range(1, len(history[metric_key]) + 1)
        ax.plot(epochs, history[metric_key], 'b-', label=f'Training {metric_name}', linewidth=2)
        
        # Plot validation metric if available
        val_key = f'val_{metric_key}'
        if val_key in history and history[val_key]:
            ax.plot(epochs, history[val_key], 'r--', label=f'Validation {metric_name}', linewidth=2)
        
        ax.set_xlabel('Epoch', fontsize=12)
        ax.set_ylabel(metric_name, fontsize=12)
        ax.set_title(f'{metric_name} over Epochs', fontsize=14, fontweight='bold')
        ax.legend(loc='best')
        ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # Save
    save_path = save_dir / 'training_history.png'
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    logger.info(f"✅ Training history plot saved: {save_path}")