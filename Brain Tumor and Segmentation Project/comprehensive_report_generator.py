"""
================================================================================
comprehensive_report_generator.py - FINAL REPORT GENERATION
================================================================================

Generates publication-ready final report with ALL metrics
Consolidates classification + segmentation results
Creates summary tables and statistics

Features:
- Consolidated metrics from both models
- Training history analysis
- Publication-ready LaTeX tables
- Conference-ready summary
- Export to multiple formats (JSON, TXT, MD, CSV)

Usage:
    from comprehensive_report_generator import ComprehensiveReportGenerator

    generator = ComprehensiveReportGenerator(
        clf_metrics_path='results/FINAL_CLASSIFICATION_METRICS.json',
        seg_metrics_path='results/FINAL_SEGMENTATION_METRICS.json'
    )
    generator.generate_complete_report('results/FINAL_COMPREHENSIVE_REPORT.txt')

================================================================================
"""

import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional
import pandas as pd

logger = logging.getLogger(__name__)

class ComprehensiveReportGenerator:
    """
    Generate comprehensive final report from all metrics
    Suitable for conference paper and technical documentation
    """

    def __init__(self, 
                 clf_metrics_path: Optional[str] = None,
                 seg_metrics_path: Optional[str] = None):
        """
        Args:
            clf_metrics_path: Path to classification metrics JSON
            seg_metrics_path: Path to segmentation metrics JSON
        """
        self.clf_metrics = self._load_metrics(clf_metrics_path) if clf_metrics_path else {}
        self.seg_metrics = self._load_metrics(seg_metrics_path) if seg_metrics_path else {}

    def _load_metrics(self, path: str) -> Dict:
        """Load metrics from JSON file"""
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load metrics from {path}: {e}")
            return {}

    def generate_complete_report(self, output_path='results/FINAL_COMPREHENSIVE_REPORT.txt'):
        """
        Generate complete text report with all metrics
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        report_lines = []

        # Header
        report_lines.extend(self._generate_header())

        # Classification results
        if self.clf_metrics:
            report_lines.extend(self._generate_classification_section())

        # Segmentation results
        if self.seg_metrics:
            report_lines.extend(self._generate_segmentation_section())

        # Summary for conference abstract
        report_lines.extend(self._generate_conference_summary())

        # LaTeX tables
        report_lines.extend(self._generate_latex_tables())

        # Write to file
        with open(output_path, 'w') as f:
            f.write('\n'.join(report_lines))

        logger.info(f"\n📄 Comprehensive report saved to: {output_path}")

        # Also save as markdown
        md_path = output_path.with_suffix('.md')
        self._save_as_markdown(report_lines, md_path)

        return output_path

    def _generate_header(self):
        lines = [
            "="*80,
            "BRAIN TUMOR DETECTION & SEGMENTATION - FINAL COMPREHENSIVE REPORT",
            "="*80,
            "",
            f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "This report contains complete evaluation metrics for the trained models.",
            "Suitable for conference paper and technical documentation.",
            "",
            "="*80,
            ""
        ]
        return lines

    def _generate_classification_section(self):
        lines = [
            "="*80,
            "SECTION 1: CLASSIFICATION MODEL PERFORMANCE (TUMOR DETECTION)",
            "="*80,
            ""
        ]

        if 'overall' in self.clf_metrics:
            overall = self.clf_metrics['overall']
            lines.extend([
                "1.1 OVERALL PERFORMANCE METRICS",
                "-" * 40,
                f"Accuracy:                  {overall['accuracy']:.4f} ({overall['accuracy']*100:.2f}%)",
                f"Precision (weighted):      {overall['precision_weighted']:.4f}",
                f"Recall (weighted):         {overall['recall_weighted']:.4f}",
                f"F1-Score (weighted):       {overall['f1_weighted']:.4f}",
                f"Precision (macro):         {overall['precision_macro']:.4f}",
                f"Recall (macro):            {overall['recall_macro']:.4f}",
                f"F1-Score (macro):          {overall['f1_macro']:.4f}",
                ""
            ])

        if 'roc_auc' in self.clf_metrics:
            roc_ci = self.clf_metrics.get('roc_auc_95_ci', {})
            lines.extend([
                "1.2 ROC ANALYSIS",
                "-" * 40,
                f"ROC-AUC Score:             {self.clf_metrics['roc_auc']:.4f}",
                f"95% Confidence Interval:   [{roc_ci.get('lower', 0):.4f}, {roc_ci.get('upper', 0):.4f}]",
                f"Average Precision (AP):    {self.clf_metrics.get('average_precision', 0):.4f}",
                ""
            ])

        if 'per_class' in self.clf_metrics:
            lines.extend([
                "1.3 PER-CLASS PERFORMANCE",
                "-" * 40
            ])

            for class_name, metrics in self.clf_metrics['per_class'].items():
                lines.extend([
                    f"\nClass: {class_name}",
                    f"  Precision:      {metrics['precision']:.4f}",
                    f"  Recall:         {metrics['recall']:.4f}",
                    f"  F1-Score:       {metrics['f1_score']:.4f}",
                    f"  Specificity:    {metrics['specificity']:.4f}",
                    f"  Support:        {metrics['support']}",
                    f"  True Positives: {metrics['true_positives']}",
                    f"  False Positives:{metrics['false_positives']}",
                    f"  False Negatives:{metrics['false_negatives']}",
                    f"  True Negatives: {metrics['true_negatives']}",
                ])

            lines.append("")

        if 'confusion_matrix' in self.clf_metrics:
            cm = self.clf_metrics['confusion_matrix']['matrix']
            lines.extend([
                "1.4 CONFUSION MATRIX",
                "-" * 40,
                "           Predicted",
                "           Healthy  Tumor",
                f"Healthy    {cm[0][0]:5d}   {cm[0][1]:5d}",
                f"Tumor      {cm[1][0]:5d}   {cm[1][1]:5d}",
                ""
            ])

        if 'class_distribution' in self.clf_metrics:
            dist = self.clf_metrics['class_distribution']
            lines.extend([
                "1.5 CLASS DISTRIBUTION IN TEST SET",
                "-" * 40,
                f"Healthy samples (0):  {dist['Healthy (0)']}  ({dist['Healthy (0)']/self.clf_metrics['total_samples']*100:.1f}%)",
                f"Tumor samples (1):    {dist['Tumor (1)']}  ({dist['Tumor (1)']/self.clf_metrics['total_samples']*100:.1f}%)",
                f"Balance ratio:        {dist['balance_ratio']:.3f}",
                "",
                "="*80,
                ""
            ])

        return lines

    def _generate_segmentation_section(self):
        lines = [
            "="*80,
            "SECTION 2: SEGMENTATION MODEL PERFORMANCE (TUMOR LOCALIZATION)",
            "="*80,
            ""
        ]

        if 'dice' in self.seg_metrics:
            dice = self.seg_metrics['dice']
            lines.extend([
                "2.1 DICE COEFFICIENT STATISTICS",
                "-" * 40,
                f"Mean Dice Score:      {dice['mean']:.4f} ± {dice['std']:.4f}",
                f"Median Dice Score:    {dice['median']:.4f}",
                f"95% Confidence Int:   [{dice['95_ci']['lower']:.4f}, {dice['95_ci']['upper']:.4f}]",
                f"Range:                [{dice['min']:.4f}, {dice['max']:.4f}]",
                f"Total samples:        {self.seg_metrics['total_samples']}",
                ""
            ])

        if 'iou' in self.seg_metrics:
            iou = self.seg_metrics['iou']
            lines.extend([
                "2.2 INTERSECTION OVER UNION (IoU) STATISTICS",
                "-" * 40,
                f"Mean IoU Score:       {iou['mean']:.4f} ± {iou['std']:.4f}",
                f"Median IoU Score:     {iou['median']:.4f}",
                f"95% Confidence Int:   [{iou['95_ci']['lower']:.4f}, {iou['95_ci']['upper']:.4f}]",
                f"Range:                [{iou['min']:.4f}, {iou['max']:.4f}]",
                ""
            ])

        if 'sensitivity' in self.seg_metrics:
            lines.extend([
                "2.3 ADDITIONAL METRICS",
                "-" * 40,
                f"Sensitivity (Recall): {self.seg_metrics['sensitivity']['mean']:.4f} ± {self.seg_metrics['sensitivity']['std']:.4f}",
                f"Specificity:          {self.seg_metrics['specificity']['mean']:.4f} ± {self.seg_metrics['specificity']['std']:.4f}",
                f"Precision:            {self.seg_metrics['precision']['mean']:.4f} ± {self.seg_metrics['precision']['std']:.4f}",
                "",
                "="*80,
                ""
            ])

        return lines

    def _generate_conference_summary(self):
        lines = [
            "="*80,
            "SECTION 3: CONFERENCE ABSTRACT SUMMARY",
            "="*80,
            "",
            "Copy-paste this section into your conference paper abstract:",
            "",
            "-" * 80
        ]

        # Classification summary
        if self.clf_metrics and 'overall' in self.clf_metrics:
            clf = self.clf_metrics
            overall = clf['overall']
            tumor_class = clf['per_class'].get('Tumor (1)', {})

            lines.extend([
                f"Our proposed ResNet50-based classification model achieved an overall ",
                f"accuracy of {overall['accuracy']*100:.2f}% on the test set of {clf['total_samples']} samples. ",
                f"The model demonstrated {overall['precision_weighted']:.3f} weighted precision, ",
                f"{overall['recall_weighted']:.3f} weighted recall, and {overall['f1_weighted']:.3f} ",
                f"weighted F1-score. Specifically for tumor detection (positive class), ",
                f"the model achieved {tumor_class.get('recall', 0):.3f} sensitivity (recall) and ",
                f"{tumor_class.get('precision', 0):.3f} precision, with an ROC-AUC of {clf.get('roc_auc', 0):.3f}. "
            ])

        # Segmentation summary
        if self.seg_metrics and 'dice' in self.seg_metrics:
            seg = self.seg_metrics
            dice = seg['dice']
            iou = seg['iou']

            lines.extend([
                f"",
                f"For tumor segmentation, our ResUNet model achieved a mean Dice coefficient ",
                f"of {dice['mean']:.4f} ± {dice['std']:.4f} (95% CI: [{dice['95_ci']['lower']:.4f}, ",
                f"{dice['95_ci']['upper']:.4f}]) and mean IoU of {iou['mean']:.4f} ± {iou['std']:.4f} ",
                f"across {seg['total_samples']} tumor samples. The segmentation model demonstrated ",
                f"{seg['sensitivity']['mean']:.3f} sensitivity and {seg['specificity']['mean']:.3f} ",
                f"specificity in tumor boundary delineation."
            ])

        lines.extend([
            "",
            "-" * 80,
            "",
            "="*80,
            ""
        ])

        return lines

    def _generate_latex_tables(self):
        lines = [
            "="*80,
            "SECTION 4: LaTeX TABLES FOR PUBLICATION",
            "="*80,
            "",
            "Copy these LaTeX tables directly into your paper:",
            "",
        ]

        # Table 1: Classification Results
        if self.clf_metrics:
            lines.extend([
                "TABLE 1: Classification Model Performance",
                "-" * 40,
                "\\begin{table}[htbp]",
                "\\centering",
                "\\caption{Classification Model Performance on Test Set}",
                "\\begin{tabular}{lc}",
                "\\hline",
                "\\textbf{Metric} & \\textbf{Value} \\\\",
                "\\hline"
            ])

            if 'overall' in self.clf_metrics:
                overall = self.clf_metrics['overall']
                lines.extend([
                    f"Accuracy & {overall['accuracy']:.4f} \\\\",
                    f"Precision (weighted) & {overall['precision_weighted']:.4f} \\\\",
                    f"Recall (weighted) & {overall['recall_weighted']:.4f} \\\\",
                    f"F1-Score (weighted) & {overall['f1_weighted']:.4f} \\\\",
                ])

            if 'roc_auc' in self.clf_metrics:
                lines.append(f"ROC-AUC & {self.clf_metrics['roc_auc']:.4f} \\\\")

            lines.extend([
                "\\hline",
                "\\end{tabular}",
                "\\end{table}",
                ""
            ])

        # Table 2: Per-Class Results
        if self.clf_metrics and 'per_class' in self.clf_metrics:
            lines.extend([
                "TABLE 2: Per-Class Classification Performance",
                "-" * 40,
                "\\begin{table}[htbp]",
                "\\centering",
                "\\caption{Per-Class Performance Metrics}",
                "\\begin{tabular}{lcccc}",
                "\\hline",
                "\\textbf{Class} & \\textbf{Precision} & \\textbf{Recall} & \\textbf{F1-Score} & \\textbf{Support} \\\\",
                "\\hline"
            ])

            for class_name, metrics in self.clf_metrics['per_class'].items():
                lines.append(
                    f"{class_name.replace('(', '(').replace(')', ')')} & "
                    f"{metrics['precision']:.4f} & "
                    f"{metrics['recall']:.4f} & "
                    f"{metrics['f1_score']:.4f} & "
                    f"{metrics['support']} \\\\"
                )

            lines.extend([
                "\\hline",
                "\\end{tabular}",
                "\\end{table}",
                ""
            ])

        # Table 3: Segmentation Results
        if self.seg_metrics:
            lines.extend([
                "TABLE 3: Segmentation Model Performance",
                "-" * 40,
                "\\begin{table}[htbp]",
                "\\centering",
                "\\caption{Segmentation Model Performance on Test Set}",
                "\\begin{tabular}{lc}",
                "\\hline",
                "\\textbf{Metric} & \\textbf{Value} \\\\",
                "\\hline"
            ])

            if 'dice' in self.seg_metrics:
                dice = self.seg_metrics['dice']
                lines.append(f"Dice Coefficient & ${dice['mean']:.4f} \\pm {dice['std']:.4f}$ \\\\")

            if 'iou' in self.seg_metrics:
                iou = self.seg_metrics['iou']
                lines.append(f"IoU Score & ${iou['mean']:.4f} \\pm {iou['std']:.4f}$ \\\\")

            if 'sensitivity' in self.seg_metrics:
                lines.extend([
                    f"Sensitivity & ${self.seg_metrics['sensitivity']['mean']:.4f} \\pm {self.seg_metrics['sensitivity']['std']:.4f}$ \\\\",
                    f"Specificity & ${self.seg_metrics['specificity']['mean']:.4f} \\pm {self.seg_metrics['specificity']['std']:.4f}$ \\\\",
                ])

            lines.extend([
                "\\hline",
                "\\end{tabular}",
                "\\end{table}",
                "",
                "="*80,
                ""
            ])

        return lines

    def _save_as_markdown(self, report_lines, output_path):
        """Save report in Markdown format"""
        # Convert to markdown-friendly format
        md_lines = []
        for line in report_lines:
            # Convert headers
            if line.startswith("="*80):
                md_lines.append("\n" + "-"*80 + "\n")
            elif line.startswith("TABLE"):
                md_lines.append("\n### " + line + "\n")
            elif line.startswith("SECTION"):
                md_lines.append("\n## " + line + "\n")
            elif line.startswith("-"*40):
                md_lines.append("")
            else:
                md_lines.append(line)

        with open(output_path, 'w') as f:
            f.write('\n'.join(md_lines))

        logger.info(f"📄 Markdown report saved to: {output_path}")

    def export_to_csv(self, output_dir='results'):
        """Export metrics to CSV files for easy analysis"""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Classification metrics CSV
        if self.clf_metrics and 'per_class' in self.clf_metrics:
            clf_df = pd.DataFrame.from_dict(self.clf_metrics['per_class'], orient='index')
            clf_csv = output_dir / 'classification_metrics.csv'
            clf_df.to_csv(clf_csv)
            logger.info(f"📊 Classification metrics CSV: {clf_csv}")

        # Segmentation metrics CSV
        if self.seg_metrics and 'dice' in self.seg_metrics:
            seg_data = {
                'Dice Mean': [self.seg_metrics['dice']['mean']],
                'Dice Std': [self.seg_metrics['dice']['std']],
                'IoU Mean': [self.seg_metrics['iou']['mean']],
                'IoU Std': [self.seg_metrics['iou']['std']],
                'Sensitivity Mean': [self.seg_metrics['sensitivity']['mean']],
                'Specificity Mean': [self.seg_metrics['specificity']['mean']],
            }
            seg_df = pd.DataFrame(seg_data)
            seg_csv = output_dir / 'segmentation_metrics.csv'
            seg_df.to_csv(seg_csv, index=False)
            logger.info(f"📊 Segmentation metrics CSV: {seg_csv}")


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == '__main__':
    print("="*80)
    print("COMPREHENSIVE REPORT GENERATOR")
    print("="*80)
    print()
    print("Usage:")
    print(">>> from comprehensive_report_generator import ComprehensiveReportGenerator")
    print(">>> ")
    print(">>> generator = ComprehensiveReportGenerator(")
    print("...     clf_metrics_path='results/FINAL_CLASSIFICATION_METRICS.json',")
    print("...     seg_metrics_path='results/FINAL_SEGMENTATION_METRICS.json'")
    print("... )")
    print(">>> ")
    print(">>> # Generate complete text report")
    print(">>> generator.generate_complete_report('results/FINAL_REPORT.txt')")
    print(">>> ")
    print(">>> # Export to CSV")
    print(">>> generator.export_to_csv('results')")
    print("="*80)
