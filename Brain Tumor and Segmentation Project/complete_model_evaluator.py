"""
complete_model_evaluator.py 

Evaluates COMPLETE trained models (not just per-epoch metrics)
Generates final metrics for conference reporting

Features:
- Complete test set evaluation
- Per-class metrics breakdown
- Statistical analysis (mean, std, CI)
- Publication-ready metrics
- JSON export for easy reporting

Usage:
    from complete_model_evaluator import CompleteModelEvaluator

    evaluator = CompleteModelEvaluator(model, test_generator, test_df)
    final_metrics = evaluator.evaluate_complete_model()
    evaluator.save_final_report('results/FINAL_METRICS.json')
"""

import json
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Tuple, Optional
from datetime import datetime
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score, roc_curve,
    precision_recall_curve, average_precision_score
)
from scipy import stats

logger = logging.getLogger(__name__)

# ============================================================================
# PART 1: COMPLETE CLASSIFICATION EVALUATOR
# ============================================================================

class CompleteClassificationEvaluator:
    """
    Complete evaluation of trained classification model
    Generates ALL metrics needed for conference reporting
    """

    def __init__(self, model, test_generator, test_df):
        """
        Args:
            model: Trained Keras model
            test_generator: Test data generator
            test_df: Test dataframe with ground truth labels
        """
        self.model = model
        self.test_generator = test_generator
        self.test_df = test_df
        self.metrics = {}

    def evaluate_complete_model(self) -> Dict:
        """
        Evaluate complete model on entire test set

        Returns:
            Dictionary with comprehensive metrics
        """
        logger.info("="*80)
        logger.info("COMPLETE MODEL EVALUATION - CLASSIFICATION")
        logger.info("="*80)

        # Get predictions for entire test set
        logger.info("\n📊 Generating predictions on complete test set...")
        y_pred_proba = self.model.predict(self.test_generator, verbose=1)
        y_pred = np.argmax(y_pred_proba, axis=1)

        # Get ground truth (handle potential length mismatch)
        y_true = self.test_df['mask'].values
        min_len = min(len(y_true), len(y_pred))
        y_true = y_true[:min_len]
        y_pred = y_pred[:min_len]
        y_pred_proba = y_pred_proba[:min_len]

        logger.info(f"✅ Predictions generated for {min_len} samples")

        # Calculate comprehensive metrics
        self.metrics = {
            'timestamp': datetime.now().isoformat(),
            'total_samples': int(min_len),
            'model_name': self.model.name if hasattr(self.model, 'name') else 'Unknown',
        }

        # Overall metrics
        self.metrics['overall'] = {
            'accuracy': float(accuracy_score(y_true, y_pred)),
            'precision_macro': float(precision_score(y_true, y_pred, average='macro', zero_division=0)),
            'precision_weighted': float(precision_score(y_true, y_pred, average='weighted', zero_division=0)),
            'recall_macro': float(recall_score(y_true, y_pred, average='macro', zero_division=0)),
            'recall_weighted': float(recall_score(y_true, y_pred, average='weighted', zero_division=0)),
            'f1_macro': float(f1_score(y_true, y_pred, average='macro', zero_division=0)),
            'f1_weighted': float(f1_score(y_true, y_pred, average='weighted', zero_division=0)),
        }

        # Per-class metrics
        cm = confusion_matrix(y_true, y_pred)
        class_names = ['Healthy (0)', 'Tumor (1)']

        self.metrics['per_class'] = {}
        for class_idx, class_name in enumerate(class_names):
            tp = cm[class_idx, class_idx]
            fp = cm[:, class_idx].sum() - tp
            fn = cm[class_idx, :].sum() - tp
            tn = cm.sum() - tp - fp - fn

            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
            specificity = tn / (tn + fp) if (tn + fp) > 0 else 0

            self.metrics['per_class'][class_name] = {
                'precision': float(precision),
                'recall': float(recall),
                'f1_score': float(f1),
                'specificity': float(specificity),
                'support': int(cm[class_idx, :].sum()),
                'true_positives': int(tp),
                'false_positives': int(fp),
                'false_negatives': int(fn),
                'true_negatives': int(tn),
            }

        # ROC AUC
        try:
            self.metrics['roc_auc'] = float(roc_auc_score(y_true, y_pred_proba[:, 1]))

            # Calculate 95% confidence interval for AUC
            auc_ci = self._bootstrap_auc_ci(y_true, y_pred_proba[:, 1])
            self.metrics['roc_auc_95_ci'] = {
                'lower': float(auc_ci[0]),
                'upper': float(auc_ci[1])
            }
        except:
            self.metrics['roc_auc'] = 0.0
            self.metrics['roc_auc_95_ci'] = {'lower': 0.0, 'upper': 0.0}

        # Average Precision (AP)
        try:
            self.metrics['average_precision'] = float(average_precision_score(y_true, y_pred_proba[:, 1]))
        except:
            self.metrics['average_precision'] = 0.0

        # Confusion matrix
        self.metrics['confusion_matrix'] = {
            'matrix': cm.tolist(),
            'normalized': (cm.astype('float') / cm.sum(axis=1)[:, np.newaxis]).tolist()
        }

        # Class balance
        class_counts = pd.Series(y_true).value_counts().to_dict()
        self.metrics['class_distribution'] = {
            'Healthy (0)': int(class_counts.get(0, 0)),
            'Tumor (1)': int(class_counts.get(1, 0)),
            'balance_ratio': float(class_counts.get(1, 0) / class_counts.get(0, 1)) if class_counts.get(0, 0) > 0 else 0
        }

        # Store predictions for visualization
        self.y_true = y_true
        self.y_pred = y_pred
        self.y_pred_proba = y_pred_proba

        # Print summary
        self._print_summary()

        return self.metrics

    def _bootstrap_auc_ci(self, y_true, y_scores, n_bootstraps=1000, ci=0.95):
        """Calculate bootstrap confidence interval for AUC"""
        bootstrapped_scores = []
        rng = np.random.RandomState(42)

        for i in range(n_bootstraps):
            # Bootstrap sample
            indices = rng.randint(0, len(y_scores), len(y_scores))
            if len(np.unique(y_true[indices])) < 2:
                continue
            score = roc_auc_score(y_true[indices], y_scores[indices])
            bootstrapped_scores.append(score)

        sorted_scores = np.array(bootstrapped_scores)
        sorted_scores.sort()

        confidence_lower = sorted_scores[int((1.0 - ci) / 2 * len(sorted_scores))]
        confidence_upper = sorted_scores[int((1.0 + ci) / 2 * len(sorted_scores))]

        return confidence_lower, confidence_upper

    def _print_summary(self):
        """Print formatted summary of results"""
        logger.info("\n" + "="*80)
        logger.info("COMPLETE MODEL PERFORMANCE SUMMARY")
        logger.info("="*80)

        logger.info(f"\n📊 Overall Metrics:")
        logger.info(f"   Accuracy:        {self.metrics['overall']['accuracy']:.4f}")
        logger.info(f"   Precision (w):   {self.metrics['overall']['precision_weighted']:.4f}")
        logger.info(f"   Recall (w):      {self.metrics['overall']['recall_weighted']:.4f}")
        logger.info(f"   F1-Score (w):    {self.metrics['overall']['f1_weighted']:.4f}")
        logger.info(f"   ROC-AUC:         {self.metrics['roc_auc']:.4f} [{self.metrics['roc_auc_95_ci']['lower']:.4f}, {self.metrics['roc_auc_95_ci']['upper']:.4f}]")

        logger.info(f"\n📈 Per-Class Performance:")
        for class_name, metrics in self.metrics['per_class'].items():
            logger.info(f"   {class_name}:")
            logger.info(f"      Precision:    {metrics['precision']:.4f}")
            logger.info(f"      Recall:       {metrics['recall']:.4f}")
            logger.info(f"      F1-Score:     {metrics['f1_score']:.4f}")
            logger.info(f"      Specificity:  {metrics['specificity']:.4f}")
            logger.info(f"      Support:      {metrics['support']}")

        logger.info(f"\n📉 Confusion Matrix:")
        cm = np.array(self.metrics['confusion_matrix']['matrix'])
        logger.info(f"   [[{cm[0,0]:4d}, {cm[0,1]:4d}]")
        logger.info(f"    [{cm[1,0]:4d}, {cm[1,1]:4d}]]")

    def save_final_report(self, output_path='results/FINAL_CLASSIFICATION_METRICS.json'):
        """Save complete metrics to JSON file"""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w') as f:
            json.dump(self.metrics, f, indent=4)

        logger.info(f"\n💾 Final metrics saved to: {output_path}")
        return output_path

    def generate_publication_plots(self, output_dir='results/publication_figures'):
        """Generate publication-ready plots"""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"\n🎨 Generating publication-ready figures...")

        # 1. Confusion Matrix (Normalized)
        self._plot_confusion_matrix_publication(output_dir / 'confusion_matrix_normalized.png')

        # 2. ROC Curve
        self._plot_roc_curve_publication(output_dir / 'roc_curve.png')

        # 3. Precision-Recall Curve
        self._plot_pr_curve_publication(output_dir / 'precision_recall_curve.png')

        # 4. Per-Class Metrics Bar Chart
        self._plot_per_class_metrics(output_dir / 'per_class_metrics.png')

        logger.info(f"✅ Publication figures saved to: {output_dir}/")

    def _plot_confusion_matrix_publication(self, output_path):
        """Plot publication-quality confusion matrix"""
        cm_normalized = np.array(self.metrics['confusion_matrix']['normalized'])

        fig, ax = plt.subplots(figsize=(8, 6))
        sns.heatmap(cm_normalized, annot=True, fmt='.2%', cmap='Blues', 
                    xticklabels=['Healthy', 'Tumor'],
                    yticklabels=['Healthy', 'Tumor'],
                    cbar_kws={'label': 'Percentage'})
        ax.set_ylabel('Ground Truth', fontsize=12, fontweight='bold')
        ax.set_xlabel('Predicted', fontsize=12, fontweight='bold')
        ax.set_title('Normalized Confusion Matrix', fontsize=14, fontweight='bold')

        plt.tight_layout()
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()

    def _plot_roc_curve_publication(self, output_path):
        """Plot publication-quality ROC curve"""
        fpr, tpr, _ = roc_curve(self.y_true, self.y_pred_proba[:, 1])

        fig, ax = plt.subplots(figsize=(8, 6))
        ax.plot(fpr, tpr, linewidth=2, label=f'ROC Curve (AUC = {self.metrics["roc_auc"]:.3f})')
        ax.plot([0, 1], [0, 1], 'k--', linewidth=1, label='Random Classifier')
        ax.set_xlabel('False Positive Rate', fontsize=12, fontweight='bold')
        ax.set_ylabel('True Positive Rate', fontsize=12, fontweight='bold')
        ax.set_title('Receiver Operating Characteristic (ROC) Curve', fontsize=14, fontweight='bold')
        ax.legend(loc='lower right', fontsize=11)
        ax.grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()

    def _plot_pr_curve_publication(self, output_path):
        """Plot publication-quality Precision-Recall curve"""
        precision, recall, _ = precision_recall_curve(self.y_true, self.y_pred_proba[:, 1])

        fig, ax = plt.subplots(figsize=(8, 6))
        ax.plot(recall, precision, linewidth=2, 
                label=f'PR Curve (AP = {self.metrics["average_precision"]:.3f})')
        ax.set_xlabel('Recall', fontsize=12, fontweight='bold')
        ax.set_ylabel('Precision', fontsize=12, fontweight='bold')
        ax.set_title('Precision-Recall Curve', fontsize=14, fontweight='bold')
        ax.legend(loc='lower left', fontsize=11)
        ax.grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()

    def _plot_per_class_metrics(self, output_path):
        """Plot per-class metrics bar chart"""
        classes = list(self.metrics['per_class'].keys())
        metrics_names = ['Precision', 'Recall', 'F1-Score', 'Specificity']

        data = {
            metric: [self.metrics['per_class'][cls][metric.lower().replace('-', '_')] 
                    for cls in classes]
            for metric in metrics_names
        }

        x = np.arange(len(classes))
        width = 0.2

        fig, ax = plt.subplots(figsize=(10, 6))

        for i, metric in enumerate(metrics_names):
            ax.bar(x + i*width, data[metric], width, label=metric)

        ax.set_ylabel('Score', fontsize=12, fontweight='bold')
        ax.set_title('Per-Class Performance Metrics', fontsize=14, fontweight='bold')
        ax.set_xticks(x + width * 1.5)
        ax.set_xticklabels(classes)
        ax.legend()
        ax.grid(True, alpha=0.3, axis='y')
        ax.set_ylim([0, 1.05])

        plt.tight_layout()
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()


# ============================================================================
# PART 2: COMPLETE SEGMENTATION EVALUATOR
# ============================================================================

class CompleteSegmentationEvaluator:
    """
    Complete evaluation of trained segmentation model
    Calculates per-image Dice, IoU with statistical analysis
    """

    def __init__(self, model, test_generator):
        self.model = model
        self.test_generator = test_generator
        self.metrics = {}

    def evaluate_complete_model(self) -> Dict:
        """
        Evaluate complete model on entire test set

        Returns:
            Dictionary with comprehensive metrics
        """
        logger.info("="*80)
        logger.info("COMPLETE MODEL EVALUATION - SEGMENTATION")
        logger.info("="*80)

        dice_scores = []
        iou_scores = []
        sensitivities = []
        specificities = []
        precisions = []

        logger.info("\n📊 Evaluating on complete test set...")

        for batch_idx in range(len(self.test_generator)):
            X_batch, y_batch = self.test_generator[batch_idx]
            pred_batch = self.model.predict(X_batch, verbose=0)
            pred_batch_binary = (pred_batch > 0.5).astype(np.float32)

            for i in range(len(X_batch)):
                mask_true = y_batch[i].flatten()
                mask_pred = pred_batch_binary[i].flatten()

                dice = self._dice_score(mask_true, mask_pred)
                iou = self._iou_score(mask_true, mask_pred)
                sensitivity, specificity, precision = self._calculate_metrics(mask_true, mask_pred)

                dice_scores.append(dice)
                iou_scores.append(iou)
                sensitivities.append(sensitivity)
                specificities.append(specificity)
                precisions.append(precision)

        # Calculate statistics
        self.metrics = {
            'timestamp': datetime.now().isoformat(),
            'total_samples': len(dice_scores),
            'dice': {
                'mean': float(np.mean(dice_scores)),
                'std': float(np.std(dice_scores)),
                'median': float(np.median(dice_scores)),
                'min': float(np.min(dice_scores)),
                'max': float(np.max(dice_scores)),
                '95_ci': self._confidence_interval(dice_scores),
                'all_scores': [float(s) for s in dice_scores]
            },
            'iou': {
                'mean': float(np.mean(iou_scores)),
                'std': float(np.std(iou_scores)),
                'median': float(np.median(iou_scores)),
                'min': float(np.min(iou_scores)),
                'max': float(np.max(iou_scores)),
                '95_ci': self._confidence_interval(iou_scores),
                'all_scores': [float(s) for s in iou_scores]
            },
            'sensitivity': {
                'mean': float(np.mean(sensitivities)),
                'std': float(np.std(sensitivities))
            },
            'specificity': {
                'mean': float(np.mean(specificities)),
                'std': float(np.std(specificities))
            },
            'precision': {
                'mean': float(np.mean(precisions)),
                'std': float(np.std(precisions))
            }
        }

        self._print_summary()

        return self.metrics

    def _dice_score(self, y_true, y_pred, smooth=1):
        intersection = np.sum(y_true * y_pred)
        return (2 * intersection + smooth) / (np.sum(y_true) + np.sum(y_pred) + smooth)

    def _iou_score(self, y_true, y_pred, smooth=1):
        intersection = np.sum(y_true * y_pred)
        union = np.sum(y_true) + np.sum(y_pred) - intersection
        return (intersection + smooth) / (union + smooth)

    def _calculate_metrics(self, y_true, y_pred):
        tp = np.sum(y_true * y_pred)
        fp = np.sum((1 - y_true) * y_pred)
        fn = np.sum(y_true * (1 - y_pred))
        tn = np.sum((1 - y_true) * (1 - y_pred))

        sensitivity = tp / (tp + fn + 1e-7)
        specificity = tn / (tn + fp + 1e-7)
        precision = tp / (tp + fp + 1e-7)

        return sensitivity, specificity, precision

    def _confidence_interval(self, data, confidence=0.95):
        n = len(data)
        mean = np.mean(data)
        se = stats.sem(data)
        margin = se * stats.t.ppf((1 + confidence) / 2, n - 1)
        return {'lower': float(mean - margin), 'upper': float(mean + margin)}

    def _print_summary(self):
        logger.info("\n" + "="*80)
        logger.info("COMPLETE MODEL PERFORMANCE SUMMARY")
        logger.info("="*80)

        logger.info(f"\n📊 Segmentation Metrics ({self.metrics['total_samples']} samples):")
        logger.info(f"   Dice Score:      {self.metrics['dice']['mean']:.4f} ± {self.metrics['dice']['std']:.4f}")
        logger.info(f"                    95% CI: [{self.metrics['dice']['95_ci']['lower']:.4f}, {self.metrics['dice']['95_ci']['upper']:.4f}]")
        logger.info(f"                    Range: [{self.metrics['dice']['min']:.4f}, {self.metrics['dice']['max']:.4f}]")

        logger.info(f"\n   IoU Score:       {self.metrics['iou']['mean']:.4f} ± {self.metrics['iou']['std']:.4f}")
        logger.info(f"                    95% CI: [{self.metrics['iou']['95_ci']['lower']:.4f}, {self.metrics['iou']['95_ci']['upper']:.4f}]")
        logger.info(f"                    Range: [{self.metrics['iou']['min']:.4f}, {self.metrics['iou']['max']:.4f}]")

        logger.info(f"\n   Sensitivity:     {self.metrics['sensitivity']['mean']:.4f} ± {self.metrics['sensitivity']['std']:.4f}")
        logger.info(f"   Specificity:     {self.metrics['specificity']['mean']:.4f} ± {self.metrics['specificity']['std']:.4f}")
        logger.info(f"   Precision:       {self.metrics['precision']['mean']:.4f} ± {self.metrics['precision']['std']:.4f}")

    def save_final_report(self, output_path='results/FINAL_SEGMENTATION_METRICS.json'):
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w') as f:
            json.dump(self.metrics, f, indent=4)

        logger.info(f"\n💾 Final metrics saved to: {output_path}")
        return output_path


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == '__main__':
    print("="*80)
    print("COMPLETE MODEL EVALUATOR")
    print("="*80)
    print()
    print("Usage for Classification:")
    print(">>> from complete_model_evaluator import CompleteClassificationEvaluator")
    print(">>> evaluator = CompleteClassificationEvaluator(model, test_gen, test_df)")
    print(">>> metrics = evaluator.evaluate_complete_model()")
    print(">>> evaluator.save_final_report('results/FINAL_CLASSIFICATION_METRICS.json')")
    print(">>> evaluator.generate_publication_plots('results/publication_figures')")
    print()
    print("Usage for Segmentation:")
    print(">>> from complete_model_evaluator import CompleteSegmentationEvaluator")
    print(">>> evaluator = CompleteSegmentationEvaluator(model, test_gen)")
    print(">>> metrics = evaluator.evaluate_complete_model()")
    print(">>> evaluator.save_final_report('results/FINAL_SEGMENTATION_METRICS.json')")
    print("="*80)
