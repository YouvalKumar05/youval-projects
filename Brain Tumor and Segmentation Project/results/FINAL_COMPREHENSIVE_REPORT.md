
--------------------------------------------------------------------------------

BRAIN TUMOR DETECTION & SEGMENTATION - FINAL COMPREHENSIVE REPORT

--------------------------------------------------------------------------------


Report Generated: 2026-02-10 12:26:47

This report contains complete evaluation metrics for the trained models.
Suitable for conference paper and technical documentation.


--------------------------------------------------------------------------------



--------------------------------------------------------------------------------


## SECTION 1: CLASSIFICATION MODEL PERFORMANCE (TUMOR DETECTION)


--------------------------------------------------------------------------------


1.1 OVERALL PERFORMANCE METRICS

Accuracy:                  0.6972 (69.72%)
Precision (weighted):      0.6840
Recall (weighted):         0.6972
F1-Score (weighted):       0.6817
Precision (macro):         0.6661
Recall (macro):            0.6350
F1-Score (macro):          0.6400

1.2 ROC ANALYSIS

ROC-AUC Score:             0.7892
95% Confidence Interval:   [0.7633, 0.8160]
Average Precision (AP):    0.6370

1.3 PER-CLASS PERFORMANCE


Class: Healthy (0)
  Precision:      0.7275
  Recall:         0.8489
  F1-Score:       0.7835
  Specificity:    0.4211
  Support:        761
  True Positives: 646
  False Positives:242
  False Negatives:115
  True Negatives: 176

Class: Tumor (1)
  Precision:      0.6048
  Recall:         0.4211
  F1-Score:       0.4965
  Specificity:    0.8489
  Support:        418
  True Positives: 176
  False Positives:115
  False Negatives:242
  True Negatives: 646

1.4 CONFUSION MATRIX

           Predicted
           Healthy  Tumor
Healthy      646     115
Tumor        242     176

1.5 CLASS DISTRIBUTION IN TEST SET

Healthy samples (0):  761  (64.5%)
Tumor samples (1):    418  (35.5%)
Balance ratio:        0.549


--------------------------------------------------------------------------------



--------------------------------------------------------------------------------


## SECTION 2: SEGMENTATION MODEL PERFORMANCE (TUMOR LOCALIZATION)


--------------------------------------------------------------------------------


2.1 DICE COEFFICIENT STATISTICS

Mean Dice Score:      0.9528 ± 0.0754
Median Dice Score:    0.9718
95% Confidence Int:   [0.9455, 0.9600]
Range:                [0.1250, 0.9927]
Total samples:        418

2.2 INTERSECTION OVER UNION (IoU) STATISTICS

Mean IoU Score:       0.9170 ± 0.0971
Median IoU Score:     0.9451
95% Confidence Int:   [0.9077, 0.9264]
Range:                [0.0949, 0.9854]

2.3 ADDITIONAL METRICS

Sensitivity (Recall): 0.9606 ± 0.0781
Specificity:          0.9990 ± 0.0014
Precision:            0.9470 ± 0.0856


--------------------------------------------------------------------------------



--------------------------------------------------------------------------------


## SECTION 3: CONFERENCE ABSTRACT SUMMARY


--------------------------------------------------------------------------------


Copy-paste this section into your conference paper abstract:


Our proposed ResNet50-based classification model achieved an overall 
accuracy of 69.72% on the test set of 1179 samples. 
The model demonstrated 0.684 weighted precision, 
0.697 weighted recall, and 0.682 
weighted F1-score. Specifically for tumor detection (positive class), 
the model achieved 0.421 sensitivity (recall) and 
0.605 precision, with an ROC-AUC of 0.789. 

For tumor segmentation, our ResUNet model achieved a mean Dice coefficient 
of 0.9528 ± 0.0754 (95% CI: [0.9455, 
0.9600]) and mean IoU of 0.9170 ± 0.0971 
across 418 tumor samples. The segmentation model demonstrated 
0.961 sensitivity and 0.999 
specificity in tumor boundary delineation.




--------------------------------------------------------------------------------



--------------------------------------------------------------------------------


## SECTION 4: LaTeX TABLES FOR PUBLICATION


--------------------------------------------------------------------------------


Copy these LaTeX tables directly into your paper:


### TABLE 1: Classification Model Performance


\begin{table}[htbp]
\centering
\caption{Classification Model Performance on Test Set}
\begin{tabular}{lc}
\hline
\textbf{Metric} & \textbf{Value} \\
\hline
Accuracy & 0.6972 \\
Precision (weighted) & 0.6840 \\
Recall (weighted) & 0.6972 \\
F1-Score (weighted) & 0.6817 \\
ROC-AUC & 0.7892 \\
\hline
\end{tabular}
\end{table}


### TABLE 2: Per-Class Classification Performance


\begin{table}[htbp]
\centering
\caption{Per-Class Performance Metrics}
\begin{tabular}{lcccc}
\hline
\textbf{Class} & \textbf{Precision} & \textbf{Recall} & \textbf{F1-Score} & \textbf{Support} \\
\hline
Healthy (0) & 0.7275 & 0.8489 & 0.7835 & 761 \\
Tumor (1) & 0.6048 & 0.4211 & 0.4965 & 418 \\
\hline
\end{tabular}
\end{table}


### TABLE 3: Segmentation Model Performance


\begin{table}[htbp]
\centering
\caption{Segmentation Model Performance on Test Set}
\begin{tabular}{lc}
\hline
\textbf{Metric} & \textbf{Value} \\
\hline
Dice Coefficient & $0.9528 \pm 0.0754$ \\
IoU Score & $0.9170 \pm 0.0971$ \\
Sensitivity & $0.9606 \pm 0.0781$ \\
Specificity & $0.9990 \pm 0.0014$ \\
\hline
\end{tabular}
\end{table}


--------------------------------------------------------------------------------

