"""
evaluator.py - COMPLETE FIXED VERSION
Fixed evaluate() method signature

Features:
- ClassificationEvaluator for tumor detection evaluation
- SegmentationEvaluator for tumor segmentation evaluation
- Proper metric calculations
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix, classification_report, roc_auc_score, roc_curve
import tensorflow as tf
import logging

logger = logging.getLogger(__name__)


class ClassificationEvaluator:
    """
    Evaluate classification model: accuracy, precision, recall, F1, confusion matrix.
    """
    
    def __init__(self, model):
        self.model = model
        self.results = {}
    
    def evaluate(self, test_generator):
        """
        Evaluate classification on test set
        
        FIXED: Removed test_df parameter (not needed!)
        
        Args:
            test_generator: Test data generator
        
        Returns:
            Dictionary with evaluation metrics
        """
        logger.info("Evaluating classification model...")
        
        y_true = []
        y_pred_proba = []
        
        for batch_idx in range(len(test_generator)):
            X_batch, y_batch = test_generator[batch_idx]
            
            # y_batch is already 1D labels
            y_true.extend(y_batch)
            
            # Get predictions
            proba = self.model.predict(X_batch, verbose=0)
            y_pred_proba.extend(proba)
        
        y_true = np.array(y_true)
        y_pred_proba = np.array(y_pred_proba)
        y_pred = np.argmax(y_pred_proba, axis=1)  # Get class from probabilities
        
        # Calculate metrics
        accuracy = np.mean(y_pred == y_true)
        
        # Precision
        tp = np.sum((y_pred == 1) & (y_true == 1))
        fp = np.sum((y_pred == 1) & (y_true == 0))
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        
        # Recall
        fn = np.sum((y_pred == 0) & (y_true == 1))
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        
        # F1 Score
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        # AUC
        try:
            auc = roc_auc_score(y_true, y_pred_proba[:, 1])
        except:
            auc = 0.0
        
        self.results = {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1': float(f1),
            'auc': float(auc),
            'y_true': y_true,
            'y_pred': y_pred,
            'y_pred_proba': y_pred_proba
        }
        
        logger.info(f"✅ Accuracy: {accuracy:.4f}, "
                   f"Precision: {precision:.4f}, "
                   f"Recall: {recall:.4f}, "
                   f"F1: {f1:.4f}, "
                   f"AUC: {auc:.4f}")
        
        return self.results
    
    def plot_confusion_matrix(self, output_path='results/confusion_matrix_clf.png'):
        """Plot confusion matrix"""
        if len(self.results) == 0:
            logger.warning("No evaluation results to plot")
            return
        
        y_true = self.results['y_true']
        y_pred = self.results['y_pred']
        
        cm = confusion_matrix(y_true, y_pred)
        
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.title('Confusion Matrix - Classification')
        plt.tight_layout()
        plt.savefig(output_path)
        plt.close()
        
        logger.info(f"✅ Confusion matrix saved to {output_path}")
    
    def plot_roc_curve(self, output_path='results/roc_curve.png'):
        """Plot ROC curve"""
        if len(self.results) == 0:
            logger.warning("No evaluation results to plot")
            return
        
        y_true = self.results['y_true']
        y_pred_proba = self.results['y_pred_proba']
        
        try:
            fpr, tpr, _ = roc_curve(y_true, y_pred_proba[:, 1])
            auc = roc_auc_score(y_true, y_pred_proba[:, 1])
            
            plt.figure(figsize=(8, 6))
            plt.plot(fpr, tpr, label=f'AUC = {auc:.4f}')
            plt.plot([0, 1], [0, 1], 'k--', label='Random')
            plt.xlabel('False Positive Rate')
            plt.ylabel('True Positive Rate')
            plt.title('ROC Curve')
            plt.legend()
            plt.tight_layout()
            plt.savefig(output_path)
            plt.close()
            
            logger.info(f"✅ ROC curve saved to {output_path}")
        except Exception as e:
            logger.warning(f"Could not plot ROC curve: {e}")


class SegmentationEvaluator:
    """
    Evaluate segmentation model: Dice, IoU, sensitivity, specificity
    """
    
    def __init__(self, model):
        self.model = model
        self.results = {}
    
    def dice_score(self, y_true, y_pred, smooth=1):
        """Calculate Dice coefficient"""
        intersection = np.sum(y_true * y_pred)
        return (2 * intersection + smooth) / (np.sum(y_true) + np.sum(y_pred) + smooth)
    
    def iou_score(self, y_true, y_pred, smooth=1):
        """Calculate IoU (Intersection over Union)"""
        intersection = np.sum(y_true * y_pred)
        union = np.sum(y_true) + np.sum(y_pred) - intersection
        return (intersection + smooth) / (union + smooth)
    
    def evaluate(self, test_generator):
        """
        Evaluate segmentation on test set
        
        Args:
            test_generator: Test data generator
        
        Returns:
            Dictionary with evaluation metrics
        """
        logger.info("Evaluating segmentation model...")
        
        dice_scores = []
        iou_scores = []
        sensitivities = []
        specificities = []
        
        for batch_idx in range(len(test_generator)):
            X_batch, y_batch = test_generator[batch_idx]
            
            predictions = self.model.predict(X_batch, verbose=0)
            predictions = (predictions > 0.5).astype(np.float32)
            
            for i in range(len(X_batch)):
                mask_pred = predictions[i]
                mask_true = y_batch[i]
                
                dice = self.dice_score(mask_true, mask_pred)
                iou = self.iou_score(mask_true, mask_pred)
                
                # Sensitivity (True Positive Rate)
                tp = np.sum(mask_true * mask_pred)
                fn = np.sum(mask_true * (1 - mask_pred))
                sensitivity = tp / (tp + fn + 1e-7)
                
                # Specificity (True Negative Rate)
                tn = np.sum((1 - mask_true) * (1 - mask_pred))
                fp = np.sum((1 - mask_true) * mask_pred)
                specificity = tn / (tn + fp + 1e-7)
                
                dice_scores.append(dice)
                iou_scores.append(iou)
                sensitivities.append(sensitivity)
                specificities.append(specificity)
        
        self.results = {
            'dice_mean': float(np.mean(dice_scores)),
            'iou_mean': float(np.mean(iou_scores)),
            'sensitivity_mean': float(np.mean(sensitivities)),
            'specificity_mean': float(np.mean(specificities)),
            'dice_std': float(np.std(dice_scores)),
            'iou_std': float(np.std(iou_scores)),
        }
        
        logger.info(f"✅ Dice: {self.results['dice_mean']:.4f}, "
                   f"IoU: {self.results['iou_mean']:.4f}, "
                   f"Sensitivity: {self.results['sensitivity_mean']:.4f}, "
                   f"Specificity: {self.results['specificity_mean']:.4f}")
        
        return self.results


if __name__ == '__main__':
    print("✅ evaluator.py loaded successfully")
    print("Contains:")
    print("  - ClassificationEvaluator")
    print("  - SegmentationEvaluator")
    