"""
================================================================================
SEGMENTATION VISUALIZER - COMPREHENSIVE METRICS & PLOTS  
================================================================================
This module generates all visualization files for the segmentation model:
- Training/Validation Loss curves
- Dice Coefficient curves
- IoU Metric curves
- Learning Rate schedule
- Sample prediction grids
- Metrics summary tables
- **NEW: Complete model evaluation on test set**

Usage:
    from segmentation_visualizer import SegmentationVisualizer
    visualizer = SegmentationVisualizer('results')
    visualizer.plot_all_metrics(history, save_prefix='segmentation')
    visualizer.evaluate_on_test_set(model, test_df, save_prefix='segmentation')
    visualizer.visualize_segmentation_predictions(
        test_df, model, num_samples=5, save_dir='results/predictions'
    )
================================================================================
"""

import os
import logging
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
import cv2
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.gridspec import GridSpec

logger = logging.getLogger(__name__)

class SegmentationVisualizer:
    """
    Comprehensive visualization for segmentation model performance
    
    Features:
        - Training curves (loss, dice, IoU)
        - Learning rate schedule
        - Metrics summary table
        - Sample prediction grids
        - Complete model evaluation on test set
    """
    
    def __init__(self, results_dir: str):
        """
        Initialize visualizer
        
        Args:
            results_dir: Directory to save visualization files
        """
        self.results_dir = Path(results_dir)
        self.results_dir.mkdir(parents=True, exist_ok=True)
        
        self.viz_dir = self.results_dir / 'visualizations'
        self.viz_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f'✅ SegmentationVisualizer initialized')
        logger.info(f'   Results dir: {self.results_dir}')
        logger.info(f'   Viz dir: {self.viz_dir}')
    
    def plot_training_curves(self, history: Dict[str, Any], save_path: str):
        """
        Plot training/validation loss + dice + IoU curves
        
        Args:
            history: Training history from model.fit()
            save_path: Path to save figure
        """
        logger.info('\n📊 Plotting training curves...')
        
        # Extract metrics
        epochs = range(1, len(history['loss']) + 1)
        loss = history['loss']
        val_loss = history.get('val_loss', [])
        dice = history.get('dice_coefficient', [])
        val_dice = history.get('val_dice_coefficient', [])
        iou = history.get('iou_metric', [])
        val_iou = history.get('val_iou_metric', [])
        
        # Create figure with 3 subplots
        fig = plt.figure(figsize=(18, 5))
        gs = GridSpec(1, 3, figure=fig)
        
        # ========== Loss Plot ==========
        ax1 = fig.add_subplot(gs[0, 0])
        ax1.plot(epochs, loss, 'b-', linewidth=2, label='Training Loss', marker='o', markersize=4)
        if val_loss:
            ax1.plot(epochs, val_loss, 'r-', linewidth=2, label='Validation Loss', marker='s', markersize=4)
        ax1.set_xlabel('Epoch', fontsize=12)
        ax1.set_ylabel('Loss', fontsize=12)
        ax1.set_title('Training & Validation Loss', fontsize=14, fontweight='bold')
        ax1.legend(loc='best', fontsize=11)
        ax1.grid(True, alpha=0.3)
        
        # ========== Dice Coefficient Plot ==========
        ax2 = fig.add_subplot(gs[0, 1])
        if dice:
            ax2.plot(epochs, dice, 'g-', linewidth=2, label='Training Dice', marker='o', markersize=4)
        if val_dice:
            ax2.plot(epochs, val_dice, 'orange', linewidth=2, label='Validation Dice', marker='s', markersize=4)
        ax2.set_xlabel('Epoch', fontsize=12)
        ax2.set_ylabel('Dice Coefficient', fontsize=12)
        ax2.set_title('Dice Coefficient (Higher = Better)', fontsize=14, fontweight='bold')
        ax2.legend(loc='best', fontsize=11)
        ax2.grid(True, alpha=0.3)
        ax2.set_ylim([0, 1])
        
        # ========== IoU Metric Plot ==========
        ax3 = fig.add_subplot(gs[0, 2])
        if iou:
            ax3.plot(epochs, iou, 'purple', linewidth=2, label='Training IoU', marker='o', markersize=4)
        if val_iou:
            ax3.plot(epochs, val_iou, 'brown', linewidth=2, label='Validation IoU', marker='s', markersize=4)
        ax3.set_xlabel('Epoch', fontsize=12)
        ax3.set_ylabel('IoU Score', fontsize=12)
        ax3.set_title('IoU Metric (Higher = Better)', fontsize=14, fontweight='bold')
        ax3.legend(loc='best', fontsize=11)
        ax3.grid(True, alpha=0.3)
        ax3.set_ylim([0, 1])
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f'✅ Training curves saved: {save_path}')
    
    def plot_lr_schedule(self, history: Dict[str, Any], save_path: str):
        """
        Plot learning rate schedule over epochs
        
        Args:
            history: Training history with 'lr' key
            save_path: Path to save figure
        """
        logger.info('\n📊 Plotting learning rate schedule...')
        
        lr = history.get('lr', [])
        if not lr:
            logger.warning('⚠️  No learning rate data found in history')
            return
        
        epochs = range(1, len(lr) + 1)
        
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.plot(epochs, lr, 'b-', linewidth=2, marker='o', markersize=5)
        ax.set_xlabel('Epoch', fontsize=12)
        ax.set_ylabel('Learning Rate', fontsize=12)
        ax.set_title('Learning Rate Schedule', fontsize=14, fontweight='bold')
        ax.set_yscale('log')  # Log scale for better visualization
        ax.grid(True, alpha=0.3)
        
        # Add annotations for key changes
        if len(lr) > 1:
            # Find where LR changes significantly
            for i in range(1, len(lr)):
                if abs(lr[i] - lr[i-1]) / lr[i-1] > 0.2:  # >20% change
                    ax.annotate(f'{lr[i]:.2e}',
                               xy=(i+1, lr[i]),
                               xytext=(10, 10),
                               textcoords='offset points',
                               fontsize=9,
                               bbox=dict(boxstyle='round,pad=0.3', fc='yellow', alpha=0.5),
                               arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0'))
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f'✅ LR schedule saved: {save_path}')
    
    def plot_metrics_summary(self, history: Dict[str, Any], save_path: str):
        """
        Create a comprehensive metrics summary table
        
        Args:
            history: Training history
            save_path: Path to save figure
        """
        logger.info('\n📊 Creating metrics summary table...')
        
        # Collect final metrics
        metrics_data = []
        
        if 'loss' in history and history['loss']:
            metrics_data.append(['Training Loss (Final)', f"{history['loss'][-1]:.4f}"])
        
        if 'val_loss' in history and history['val_loss']:
            metrics_data.append(['Validation Loss (Final)', f"{history['val_loss'][-1]:.4f}"])
            best_val_loss = min(history['val_loss'])
            best_epoch = history['val_loss'].index(best_val_loss) + 1
            metrics_data.append(['Best Validation Loss', f"{best_val_loss:.4f} (Epoch {best_epoch})"])
        
        if 'dice_coefficient' in history and history['dice_coefficient']:
            metrics_data.append(['Training Dice (Final)', f"{history['dice_coefficient'][-1]:.4f}"])
        
        if 'val_dice_coefficient' in history and history['val_dice_coefficient']:
            metrics_data.append(['Validation Dice (Final)', f"{history['val_dice_coefficient'][-1]:.4f}"])
            best_val_dice = max(history['val_dice_coefficient'])
            best_epoch = history['val_dice_coefficient'].index(best_val_dice) + 1
            metrics_data.append(['Best Validation Dice', f"{best_val_dice:.4f} (Epoch {best_epoch})"])
        
        if 'iou_metric' in history and history['iou_metric']:
            metrics_data.append(['Training IoU (Final)', f"{history['iou_metric'][-1]:.4f}"])
        
        if 'val_iou_metric' in history and history['val_iou_metric']:
            metrics_data.append(['Validation IoU (Final)', f"{history['val_iou_metric'][-1]:.4f}"])
            best_val_iou = max(history['val_iou_metric'])
            best_epoch = history['val_iou_metric'].index(best_val_iou) + 1
            metrics_data.append(['Best Validation IoU', f"{best_val_iou:.4f} (Epoch {best_epoch})"])
        
        metrics_data.append(['Total Epochs Trained', str(len(history.get('loss', [])))])
        
        # Create figure
        fig, ax = plt.subplots(figsize=(10, len(metrics_data) * 0.6 + 1))
        ax.axis('tight')
        ax.axis('off')
        
        # Create table
        table = ax.table(
            cellText=metrics_data,
            colLabels=['Metric', 'Value'],
            cellLoc='left',
            loc='center',
            colWidths=[0.6, 0.4]
        )
        
        # Style table
        table.auto_set_font_size(False)
        table.set_fontsize(11)
        table.scale(1, 2)
        
        # Header styling
        for i in range(2):
            table[(0, i)].set_facecolor('#4ECDC4')
            table[(0, i)].set_text_props(weight='bold', color='white')
        
        # Alternating row colors
        for i in range(1, len(metrics_data) + 1):
            for j in range(2):
                if i % 2 == 0:
                    table[(i, j)].set_facecolor('#f0f0f0')
                else:
                    table[(i, j)].set_facecolor('#ffffff')
        
        # Title
        plt.title('Segmentation Model - Metrics Summary',
                 fontsize=14, fontweight='bold', pad=20)
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f'✅ Metrics summary saved: {save_path}')
    
    def plot_all_metrics(self, history: Dict[str, Any], save_prefix: str = 'segmentation'):
        """
        Generate all metric visualizations
        
        Args:
            history: Training history from model.fit()
            save_prefix: Prefix for saved files
        """
        logger.info('\n' + '='*80)
        logger.info('GENERATING SEGMENTATION VISUALIZATIONS')
        logger.info('='*80)
        
        # Convert history if it's a History object
        if hasattr(history, 'history'):
            history = history.history
        
        # Training curves
        self.plot_training_curves(
            history,
            str(self.viz_dir / f'{save_prefix}_training_curves.png')
        )
        
        # LR schedule
        self.plot_lr_schedule(
            history,
            str(self.viz_dir / f'{save_prefix}_lr_schedule.png')
        )
        
        # Metrics summary
        self.plot_metrics_summary(
            history,
            str(self.viz_dir / f'{save_prefix}_metrics_summary.png')
        )
        
        logger.info('\n✅ All metric visualizations generated!')
        logger.info(f'   Location: {self.viz_dir}/')
    
    def visualize_segmentation_predictions(
        self,
        df: pd.DataFrame,
        model: Any,
        num_samples: int = 5,
        save_dir: str = None
    ):
        """
        Generate segmentation prediction visualizations
        
        Args:
            df: DataFrame with image/mask paths
            model: Trained segmentation model
            num_samples: Number of predictions to generate
            save_dir: Directory to save predictions (default: self.results_dir/predictions)
        """
        logger.info('\n' + '='*80)
        logger.info('GENERATING SEGMENTATION PREDICTIONS')
        logger.info('='*80)
        
        if save_dir is None:
            save_dir = self.results_dir / 'predictions'
        save_dir = Path(save_dir)
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Filter to tumor samples only
        tumor_df = df[df['mask'] == 1].reset_index(drop=True)
        
        if len(tumor_df) == 0:
            logger.warning('⚠️  No tumor samples found for visualization')
            return
        
        # Select random samples
        num_samples = min(num_samples, len(tumor_df))
        selected_indices = np.random.choice(len(tumor_df), num_samples, replace=False)
        
        logger.info(f'📊 Generating {num_samples} segmentation predictions...')
        
        for pred_num, idx in enumerate(selected_indices, 1):
            row = tumor_df.iloc[idx]
            
            # Read and preprocess image
            img = cv2.imread(row['image_path'], cv2.IMREAD_GRAYSCALE)
            if img is None:
                logger.warning(f'⚠️  Could not read image: {row["image_path"]}')
                continue
            
            img_original = img.copy()
            img_resized = cv2.resize(img, (256, 256))
            img_normalized = img_resized.astype('float32') / 255.0
            X = np.expand_dims(np.expand_dims(img_normalized, axis=-1), axis=0)
            
            # Predict
            pred_mask = model.predict(X, verbose=0)[0, :, :, 0]
            pred_mask_binary = (pred_mask > 0.5).astype('uint8') * 255
            
            # Read ground truth mask
            true_mask = None
            if row['mask_path'] and Path(row['mask_path']).exists():
                true_mask = cv2.imread(row['mask_path'], cv2.IMREAD_GRAYSCALE)
            
            # Calculate metrics
            if true_mask is not None:
                true_mask_resized = cv2.resize(true_mask, (256, 256))
                true_mask_binary = (true_mask_resized > 127).astype('float32')
                pred_mask_float = (pred_mask > 0.5).astype('float32')
                
                # Dice coefficient
                intersection = np.sum(true_mask_binary * pred_mask_float)
                dice = (2.0 * intersection + 1e-6) / (np.sum(true_mask_binary) + np.sum(pred_mask_float) + 1e-6)
                
                # IoU
                union = np.sum(np.maximum(true_mask_binary, pred_mask_float))
                iou = (intersection + 1e-6) / (union + 1e-6)
            else:
                dice, iou = None, None
            
            # Visualize
            fig = plt.figure(figsize=(16, 4))
            gs = GridSpec(1, 4, figure=fig)
            
            # Original image
            ax1 = fig.add_subplot(gs[0, 0])
            ax1.imshow(img_original, cmap='gray')
            ax1.set_title('Original MRI', fontsize=12, fontweight='bold')
            ax1.axis('off')
            
            # Ground truth mask
            ax2 = fig.add_subplot(gs[0, 1])
            if true_mask is not None:
                ax2.imshow(true_mask, cmap='gray')
                ax2.set_title('Ground Truth Mask', fontsize=12, fontweight='bold')
            else:
                ax2.text(0.5, 0.5, 'No Ground Truth', ha='center', va='center', fontsize=12)
            ax2.axis('off')
            
            # Predicted mask
            ax3 = fig.add_subplot(gs[0, 2])
            ax3.imshow(pred_mask_binary, cmap='gray')
            title = 'AI Predicted Mask'
            if dice is not None:
                title += f'\nDice: {dice:.3f} | IoU: {iou:.3f}'
            ax3.set_title(title, fontsize=12, fontweight='bold')
            ax3.axis('off')
            
            # Overlay
            ax4 = fig.add_subplot(gs[0, 3])
            img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_GRAY2RGB)
            overlay = img_rgb.copy()
            overlay[pred_mask_binary == 255] = [0, 255, 0]  # Green
            blended = cv2.addWeighted(img_rgb, 0.6, overlay, 0.4, 0)
            ax4.imshow(blended)
            ax4.set_title('Overlay (Green = Tumor)', fontsize=12, fontweight='bold')
            ax4.axis('off')
            
            plt.tight_layout()
            save_path = save_dir / f'seg_prediction_{pred_num:03d}.png'
            plt.savefig(save_path, dpi=200, bbox_inches='tight')
            plt.close()
            
            logger.info(f'   ✅ Prediction {pred_num}/{num_samples} saved')
        
        logger.info(f'\n✅ All predictions saved to: {save_dir}/')
        
        # Generate grid of predictions
        self._create_prediction_grid(save_dir, num_samples)
    
    def _create_prediction_grid(self, predictions_dir: Path, num_samples: int):
        """
        Create a grid view of all predictions
        
        Args:
            predictions_dir: Directory containing individual predictions
            num_samples: Number of samples
        """
        logger.info('\n📊 Creating predictions grid...')
        
        # Load individual predictions
        images = []
        for i in range(1, num_samples + 1):
            img_path = predictions_dir / f'seg_prediction_{i:03d}.png'
            if img_path.exists():
                img = cv2.imread(str(img_path))
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                images.append(img)
        
        if not images:
            logger.warning('⚠️  No prediction images found to create grid')
            return
        
        # Create grid
        fig, axes = plt.subplots(len(images), 1, figsize=(16, 4 * len(images)))
        if len(images) == 1:
            axes = [axes]
        
        for ax, img in zip(axes, images):
            ax.imshow(img)
            ax.axis('off')
        
        plt.suptitle('Segmentation Predictions - Grid View',
                    fontsize=16, fontweight='bold', y=0.995)
        plt.tight_layout()
        
        grid_path = self.viz_dir / 'segmentation_predictions_grid.png'
        plt.savefig(grid_path, dpi=200, bbox_inches='tight')
        plt.close()
        
        logger.info(f'✅ Predictions grid saved: {grid_path}')
    
    # ============================================================================
    # NEW METHOD: COMPLETE MODEL EVALUATION ON TEST SET
    # ============================================================================
    
    def evaluate_on_test_set(
        self,
        model,
        test_df: pd.DataFrame,
        save_prefix: str = 'segmentation'
    ) -> Dict[str, float]:
        """
        Evaluate complete trained model on test set
        
        Generates comprehensive metrics for the entire model regardless of
        current training session. This ensures we always see full model performance.
        
        Args:
            model: Trained segmentation model
            test_df: Test dataframe with image/mask paths
            save_prefix: Prefix for saved files
            
        Returns:
            Dictionary with test metrics (loss, dice, iou)
        """
        logger.info('\n📊 EVALUATING COMPLETE MODEL ON TEST SET')
        logger.info('=' * 80)
        
        # Prepare test data
        test_images = []
        test_masks = []
        
        for idx, row in test_df.iterrows():
            # Load image
            img = cv2.imread(row['image_path'], cv2.IMREAD_GRAYSCALE)
            if img is None:
                logger.warning(f"Could not load image: {row['image_path']}")
                continue
            img = cv2.resize(img, (256, 256))
            img = img.astype(np.float32) / 255.0
            img = np.expand_dims(img, axis=-1)
            test_images.append(img)
            
            # Load mask
            mask = cv2.imread(row['mask_path'], cv2.IMREAD_GRAYSCALE)
            if mask is None:
                logger.warning(f"Could not load mask: {row['mask_path']}")
                continue
            mask = cv2.resize(mask, (256, 256))
            mask = (mask > 127).astype(np.float32)  # Binary threshold
            mask = np.expand_dims(mask, axis=-1)
            test_masks.append(mask)
        
        test_images = np.array(test_images)
        test_masks = np.array(test_masks)
        
        logger.info(f'✅ Loaded {len(test_images)} test samples')
        
        # Evaluate model
        logger.info('\n🔍 Running model evaluation...')
        test_results = model.evaluate(
            test_images,
            test_masks,
            batch_size=8,
            verbose=1
        )
        
        # Extract metrics
        metric_names = model.metrics_names
        test_metrics = dict(zip(metric_names, test_results))
        
        # Log results
        logger.info('\n📊 TEST SET RESULTS (Complete Model):')
        logger.info('─' * 60)
        for metric_name, value in test_metrics.items():
            logger.info(f'  {metric_name:20s}: {value:.4f}')
        logger.info('─' * 60)
        
        # Generate prediction samples
        logger.info('\n🖼️  Generating prediction samples...')
        sample_indices = np.random.choice(len(test_images), size=min(5, len(test_images)), replace=False)
        predictions = model.predict(test_images[sample_indices], verbose=0)
        
        # Save visualizations
        self._save_test_evaluation_plots(
            test_images[sample_indices],
            test_masks[sample_indices],
            predictions,
            test_metrics,
            save_prefix
        )
        
        logger.info('✅ Complete model evaluation finished')
        
        return test_metrics
    
    def _save_test_evaluation_plots(
        self,
        images: np.ndarray,
        masks: np.ndarray,
        predictions: np.ndarray,
        metrics: Dict[str, float],
        save_prefix: str
    ):
        """Save test evaluation visualizations"""
        
        # 1. Create metrics summary image
        fig_summary = plt.figure(figsize=(10, 6))
        ax = fig_summary.add_subplot(111)
        ax.axis('off')
        
        # Create metrics table
        metrics_text = [
            ["Metric", "Value"],
            ["─" * 25, "─" * 15]
        ]
        for metric_name, value in metrics.items():
            display_name = metric_name.replace('_', ' ').title()
            metrics_text.append([display_name, f"{value:.4f}"])
        
        table = ax.table(
            cellText=metrics_text,
            cellLoc='left',
            loc='center',
            colWidths=[0.6, 0.3]
        )
        table.auto_set_font_size(False)
        table.set_fontsize(12)
        table.scale(1, 2)
        
        # Style header
        for i in range(2):
            for j in range(2):
                cell = table[(i, j)]
                cell.set_facecolor('#4CAF50' if i == 0 else '#E8F5E9')
                cell.set_text_props(weight='bold' if i == 0 else 'normal')
        
        plt.title('Complete Model Performance on Test Set', fontsize=16, fontweight='bold', pad=20)
        
        summary_path = self.viz_dir / f'{save_prefix}_test_metrics_summary.png'
        plt.savefig(summary_path, dpi=300, bbox_inches='tight')
        plt.close()
        logger.info(f'✅ Metrics summary saved: {summary_path}')
        
        # 2. Create prediction comparison grid
        n_samples = len(images)
        fig = plt.figure(figsize=(15, n_samples * 3))
        
        for idx in range(n_samples):
            # Original image
            ax1 = plt.subplot(n_samples, 4, idx * 4 + 1)
            ax1.imshow(images[idx].squeeze(), cmap='gray')
            ax1.set_title('Original MRI', fontsize=10, fontweight='bold')
            ax1.axis('off')
            
            # Ground truth mask
            ax2 = plt.subplot(n_samples, 4, idx * 4 + 2)
            ax2.imshow(masks[idx].squeeze(), cmap='gray')
            ax2.set_title('Ground Truth', fontsize=10, fontweight='bold')
            ax2.axis('off')
            
            # Predicted mask
            pred_binary = (predictions[idx].squeeze() > 0.5).astype(np.uint8)
            ax3 = plt.subplot(n_samples, 4, idx * 4 + 3)
            ax3.imshow(pred_binary, cmap='gray')
            ax3.set_title('Model Prediction', fontsize=10, fontweight='bold')
            ax3.axis('off')
            
            # Overlay
            ax4 = plt.subplot(n_samples, 4, idx * 4 + 4)
            ax4.imshow(images[idx].squeeze(), cmap='gray')
            ax4.imshow(pred_binary, cmap='Reds', alpha=0.5)
            ax4.set_title('Prediction Overlay', fontsize=10, fontweight='bold')
            ax4.axis('off')
            
            # Calculate per-sample metrics
            dice = self._calculate_dice(masks[idx].squeeze(), pred_binary)
            iou = self._calculate_iou(masks[idx].squeeze(), pred_binary)
            ax4.text(0.5, -0.1, f'Dice: {dice:.3f} | IoU: {iou:.3f}',
                    ha='center', va='top', transform=ax4.transAxes,
                    fontsize=9, bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        plt.suptitle('Test Set Predictions - Complete Model', fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        predictions_path = self.viz_dir / f'{save_prefix}_test_predictions.png'
        plt.savefig(predictions_path, dpi=300, bbox_inches='tight')
        plt.close()
        logger.info(f'✅ Test predictions saved: {predictions_path}')
    
    def _calculate_dice(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """Calculate Dice coefficient"""
        y_true = y_true.flatten()
        y_pred = y_pred.flatten()
        intersection = np.sum(y_true * y_pred)
        return (2. * intersection + 1e-7) / (np.sum(y_true) + np.sum(y_pred) + 1e-7)
    
    def _calculate_iou(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """Calculate IoU"""
        y_true = y_true.flatten()
        y_pred = y_pred.flatten()
        intersection = np.sum(y_true * y_pred)
        union = np.sum(y_true) + np.sum(y_pred) - intersection
        return (intersection + 1e-7) / (union + 1e-7)


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == '__main__':
    """
    Example usage demonstration
    """
    print('='*80)
    print('SEGMENTATION VISUALIZER - EXAMPLE USAGE')
    print('='*80)
    print()
    print('1. Initialize visualizer:')
    print('   visualizer = SegmentationVisualizer("results")')
    print()
    print('2. After training, generate all metrics:')
    print('   history = model.fit(...)')
    print('   visualizer.plot_all_metrics(history)')
    print()
    print('3. Evaluate complete model on test set:')
    print('   test_metrics = visualizer.evaluate_on_test_set(model, test_df)')
    print()
    print('4. Generate sample predictions:')
    print('   visualizer.visualize_segmentation_predictions(')
    print('       test_df, model, num_samples=5')
    print('   )')
    print()
    print('='*80)
    print('OUTPUT FILES:')
    print('='*80)
    print('results/visualizations/')
    print('├── segmentation_training_curves.png')
    print('├── segmentation_lr_schedule.png')
    print('├── segmentation_metrics_summary.png')
    print('├── segmentation_test_metrics_summary.png    ← NEW!')
    print('├── segmentation_test_predictions.png         ← NEW!')
    print('└── segmentation_predictions_grid.png')
    print()
    print('results/predictions/')
    print('├── seg_prediction_001.png')
    print('├── seg_prediction_002.png')
    print('├── seg_prediction_003.png')
    print('├── seg_prediction_004.png')
    print('└── seg_prediction_005.png')
    print()
    print('='*80)
