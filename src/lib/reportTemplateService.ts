// Report Template Service for Professional PDF Generation
// Creates HTML templates with scoring visualization and branding

import type { AuditReportData, PDFTemplate, ChartData } from '../types/pdf';

export class ReportTemplateService {
  
  /**
   * Generate HTML content for PDF report
   */
  generateReportHTML(data: AuditReportData, template: PDFTemplate = this.getDefaultTemplate()): string {
    const { customizations } = data;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Readiness Audit Report - ${data.organizationName}</title>
    <style>
        ${this.generateCSS(template)}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    ${template.components.coverPage ? this.generateCoverPage(data, template) : ''}
    ${template.components.executiveSummary && customizations?.includeExecutiveSummary ? this.generateExecutiveSummary(data) : ''}
    ${template.components.scoreOverview ? this.generateScoreOverview(data) : ''}
    ${template.components.pillarAnalysis ? this.generatePillarAnalysis(data) : ''}
    ${template.components.detailedFindings ? this.generateDetailedFindings(data) : ''}
    ${template.components.recommendations && customizations?.includeRecommendations ? this.generateRecommendations(data) : ''}
    ${template.components.actionPlan && customizations?.includeActionPlan ? this.generateActionPlan(data) : ''}
    ${template.components.benchmarks && customizations?.includeBenchmarks ? this.generateBenchmarks(data) : ''}
    ${template.components.methodology ? this.generateMethodology(data) : ''}
    ${template.components.appendix && customizations?.includeAppendix ? this.generateAppendix(data) : ''}
    
    <script>
        ${this.generateChartJS(data)}
    </script>
</body>
</html>`;
  }

  /**
   * Generate CSS for professional styling
   */
  private generateCSS(template: PDFTemplate): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: ${template.styling.fontFamily}, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            line-height: 1.6;
            color: #333;
            font-size: 14px;
        }
        
        .page {
            min-height: 100vh;
            padding: 40px;
            page-break-after: always;
        }
        
        .page:last-child {
            page-break-after: auto;
        }
        
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 30px;
            border-bottom: 2px solid ${template.styling.primaryColor};
            margin-bottom: 40px;
        }
        
        .logo {
            height: 60px;
        }
        
        .header-text {
            text-align: right;
            color: #666;
        }
        
        h1 {
            color: ${template.styling.primaryColor};
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 20px;
        }
        
        h2 {
            color: ${template.styling.primaryColor};
            font-size: 22px;
            font-weight: 600;
            margin: 30px 0 15px 0;
            border-bottom: 1px solid #e5e5e5;
            padding-bottom: 8px;
        }
        
        h3 {
            color: ${template.styling.secondaryColor};
            font-size: 18px;
            font-weight: 600;
            margin: 25px 0 12px 0;
        }
        
        .score-card {
            background: linear-gradient(135deg, ${template.styling.primaryColor}15, ${template.styling.primaryColor}05);
            border-left: 4px solid ${template.styling.primaryColor};
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        
        .score-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .pillar-card {
            background: white;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .pillar-title {
            font-weight: 600;
            color: ${template.styling.primaryColor};
            margin-bottom: 10px;
        }
        
        .score-bar {
            background: #f0f0f0;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .score-fill {
            background: linear-gradient(90deg, ${template.styling.primaryColor}, ${template.styling.secondaryColor});
            height: 100%;
            transition: width 0.3s ease;
        }
        
        .score-text {
            font-size: 24px;
            font-weight: 700;
            color: ${template.styling.primaryColor};
        }
        
        .level-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .level-beginner { background: #fee2e2; color: #dc2626; }
        .level-developing { background: #fef3c7; color: #d97706; }
        .level-proficient { background: #dbeafe; color: #2563eb; }
        .level-advanced { background: #dcfce7; color: #16a34a; }
        .level-expert { background: #f3e8ff; color: #9333ea; }
        
        .recommendation {
            background: white;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
        }
        
        .recommendation.high { border-left: 4px solid #dc2626; }
        .recommendation.medium { border-left: 4px solid #d97706; }
        .recommendation.low { border-left: 4px solid #16a34a; }
        
        .chart-container {
            width: 100%;
            height: 300px;
            margin: 20px 0;
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin: 20px 0;
        }
        
        .strengths-weaknesses {
            background: white;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e5e5e5;
        }
        
        .strengths { border-left: 4px solid #16a34a; }
        .weaknesses { border-left: 4px solid #dc2626; }
        
        .benchmark-comparison {
            text-align: center;
            padding: 30px;
            background: linear-gradient(135deg, ${template.styling.primaryColor}10, ${template.styling.secondaryColor}10);
            border-radius: 12px;
            margin: 20px 0;
        }
        
        .benchmark-score {
            font-size: 48px;
            font-weight: 700;
            color: ${template.styling.primaryColor};
            margin: 10px 0;
        }
        
        ul {
            margin: 10px 0 10px 20px;
        }
        
        li {
            margin: 5px 0;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        
        @media print {
            body { font-size: 12px; }
            .page { padding: 20px; }
            .chart-container { break-inside: avoid; }
            .recommendation { break-inside: avoid; }
        }
    `;
  }

  /**
   * Generate cover page
   */
  private generateCoverPage(data: AuditReportData, template: PDFTemplate): string {
    return `
    <div class="page">
        <div class="header">
            ${data.customizations?.logoUrl ? `<img src="${data.customizations.logoUrl}" alt="Logo" class="logo" />` : ''}
            <div class="header-text">
                <div>Agent Readiness Audit</div>
                <div>${new Date(data.generatedAt).toLocaleDateString()}</div>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 100px;">
            <h1 style="font-size: 36px; margin-bottom: 30px;">Agent Readiness Audit Report</h1>
            <h2 style="font-size: 24px; color: #666; font-weight: normal; margin-bottom: 50px;">${data.organizationName}</h2>
            
            <div class="score-card" style="max-width: 400px; margin: 50px auto; text-align: center;">
                <div style="font-size: 18px; margin-bottom: 10px;">Overall Readiness Score</div>
                <div class="score-text" style="font-size: 48px;">${data.totalScore}</div>
                <div style="font-size: 14px; color: #666;">out of ${data.maxPossibleScore}</div>
                <div class="score-bar" style="margin: 20px 0;">
                    <div class="score-fill" style="width: ${(data.totalScore / data.maxPossibleScore) * 100}%;"></div>
                </div>
            </div>
            
            <div style="margin-top: 80px; color: #666;">
                <p>Assessment completed: ${new Date(data.completedAt).toLocaleDateString()}</p>
                <p>Report generated: ${new Date(data.generatedAt).toLocaleDateString()}</p>
                <p>Version: ${data.version}</p>
            </div>
        </div>
    </div>`;
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(data: AuditReportData): string {
    const readinessLevel = this.getOverallReadinessLevel(data.totalScore, data.maxPossibleScore);
    
    return `
    <div class="page">
        <h1>Executive Summary</h1>
        
        <div class="score-card">
            <h3>Assessment Overview</h3>
            <p><strong>${data.organizationName}</strong> has completed a comprehensive Agent Readiness Audit to evaluate 
            preparedness for implementing AI agents. The assessment covered ${Object.keys(data.pillarScores).length} key areas 
            across ${data.totalSteps} evaluation criteria.</p>
            
            <div style="margin: 20px 0;">
                <span class="level-badge level-${readinessLevel.toLowerCase()}">${readinessLevel} Readiness</span>
                <span style="margin-left: 20px; font-size: 18px; font-weight: 600;">
                    ${data.totalScore}/${data.maxPossibleScore} (${Math.round((data.totalScore / data.maxPossibleScore) * 100)}%)
                </span>
            </div>
        </div>
        
        <h3>Key Findings</h3>
        <div class="two-column">
            <div class="strengths-weaknesses strengths">
                <h4 style="color: #16a34a; margin-bottom: 15px;">Strengths</h4>
                <ul>
                    ${data.strengths.map(strength => `<li>${strength}</li>`).join('')}
                </ul>
            </div>
            <div class="strengths-weaknesses weaknesses">
                <h4 style="color: #dc2626; margin-bottom: 15px;">Areas for Improvement</h4>
                <ul>
                    ${data.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                </ul>
            </div>
        </div>
        
        <h3>Readiness Assessment by Area</h3>
        <div class="score-grid">
            ${Object.entries(data.pillarScores).map(([pillar, scores]) => `
            <div class="pillar-card">
                <div class="pillar-title">${pillar}</div>
                <div class="score-text">${scores.percentage}%</div>
                <div class="score-bar">
                    <div class="score-fill" style="width: ${scores.percentage}%;"></div>
                </div>
                <span class="level-badge level-${scores.level}">${scores.level}</span>
            </div>
            `).join('')}
        </div>
        
        <h3>Recommended Next Steps</h3>
        <ol>
            ${data.recommendations.filter(r => r.priority === 'high').slice(0, 3).map(rec => `
            <li><strong>${rec.title}</strong> - ${rec.description}</li>
            `).join('')}
        </ol>
    </div>`;
  }

  /**
   * Generate detailed score overview with charts
   */
  private generateScoreOverview(data: AuditReportData): string {
    return `
    <div class="page">
        <h1>Detailed Score Analysis</h1>
        
        <div class="two-column">
            <div>
                <h3>Overall Performance</h3>
                <div class="chart-container">
                    <canvas id="overallChart"></canvas>
                </div>
            </div>
            <div>
                <h3>Readiness by Pillar</h3>
                <div class="chart-container">
                    <canvas id="pillarChart"></canvas>
                </div>
            </div>
        </div>
        
        ${data.industryBenchmark ? `
        <div class="benchmark-comparison">
            <h3>Industry Benchmark Comparison</h3>
            <div style="display: flex; justify-content: space-around; align-items: center;">
                <div>
                    <div style="font-size: 14px; color: #666;">Your Score</div>
                    <div class="benchmark-score">${data.totalScore}</div>
                </div>
                <div style="font-size: 24px; color: #666;">vs</div>
                <div>
                    <div style="font-size: 14px; color: #666;">${data.industryBenchmark.industry} Average</div>
                    <div class="benchmark-score" style="color: #666;">${data.industryBenchmark.averageScore}</div>
                </div>
            </div>
            <p style="margin-top: 20px;">
                You scored ${data.industryBenchmark.comparison} the industry average, 
                placing you in the ${data.industryBenchmark.percentile}th percentile.
            </p>
        </div>
        ` : ''}
        
        <h3>Score Breakdown</h3>
        <div class="score-grid">
            ${Object.entries(data.pillarScores).map(([pillar, scores]) => `
            <div class="pillar-card">
                <div class="pillar-title">${pillar}</div>
                <div style="margin: 15px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="score-text">${scores.score}</span>
                        <span style="color: #666;">/${scores.maxScore}</span>
                    </div>
                    <div class="score-bar">
                        <div class="score-fill" style="width: ${scores.percentage}%;"></div>
                    </div>
                    <span class="level-badge level-${scores.level}">${scores.level}</span>
                </div>
                <div style="font-size: 12px; color: #666;">
                    ${scores.completedQuestions}/${scores.questions} questions completed
                </div>
            </div>
            `).join('')}
        </div>
    </div>`;
  }

  /**
   * Generate pillar analysis section
   */
  private generatePillarAnalysis(data: AuditReportData): string {
    return `
    <div class="page">
        <h1>Detailed Pillar Analysis</h1>
        
        ${Object.entries(data.pillarScores).map(([pillar, scores]) => `
        <div style="margin-bottom: 40px;">
            <h2>${pillar}</h2>
            <div class="pillar-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div>
                        <span class="score-text">${scores.score}/${scores.maxScore}</span>
                        <span style="margin-left: 15px;" class="level-badge level-${scores.level}">${scores.level}</span>
                    </div>
                    <div style="font-size: 24px; font-weight: 600; color: ${scores.percentage >= 80 ? '#16a34a' : scores.percentage >= 60 ? '#d97706' : '#dc2626'};">
                        ${scores.percentage}%
                    </div>
                </div>
                <div class="score-bar">
                    <div class="score-fill" style="width: ${scores.percentage}%;"></div>
                </div>
                <div style="margin-top: 15px; font-size: 14px; color: #666;">
                    Assessment based on ${scores.questions} evaluation criteria
                </div>
            </div>
            
            <h4>Analysis</h4>
            <p>${this.getPillarAnalysis(pillar, scores)}</p>
            
            <h4>Recommendations</h4>
            <ul>
                ${data.recommendations
                  .filter(rec => rec.category.toLowerCase().includes(pillar.toLowerCase().split(' ')[0]))
                  .slice(0, 2)
                  .map(rec => `<li><strong>${rec.title}</strong> - ${rec.description}</li>`)
                  .join('')}
            </ul>
        </div>
        `).join('')}
    </div>`;
  }

  /**
   * Generate detailed findings
   */
  private generateDetailedFindings(data: AuditReportData): string {
    return `
    <div class="page">
        <h1>Detailed Findings</h1>
        
        <h2>Assessment Methodology</h2>
        <p>This assessment evaluated your organization across ${Object.keys(data.pillarScores).length} key pillars 
        using ${data.totalSteps} comprehensive evaluation criteria. Each area was scored based on current capabilities, 
        processes, and readiness indicators.</p>
        
        <h2>Question-by-Question Analysis</h2>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Total Questions:</strong> ${Object.values(data.pillarScores).reduce((acc, p) => acc + p.questions, 0)}</p>
            <p><strong>Completed:</strong> ${Object.values(data.pillarScores).reduce((acc, p) => acc + p.completedQuestions, 0)}</p>
            <p><strong>Completion Rate:</strong> ${Math.round((Object.values(data.pillarScores).reduce((acc, p) => acc + p.completedQuestions, 0) / Object.values(data.pillarScores).reduce((acc, p) => acc + p.questions, 0)) * 100)}%</p>
        </div>
        
        <h2>Key Answers Summary</h2>
        <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px;">
            ${this.generateKeyAnswersSummary(data.answers)}
        </div>
        
        <h2>Scoring Matrix</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
                <tr style="background: #f9fafb;">
                    <th style="border: 1px solid #e5e5e5; padding: 12px; text-align: left;">Pillar</th>
                    <th style="border: 1px solid #e5e5e5; padding: 12px; text-align: center;">Score</th>
                    <th style="border: 1px solid #e5e5e5; padding: 12px; text-align: center;">Percentage</th>
                    <th style="border: 1px solid #e5e5e5; padding: 12px; text-align: center;">Level</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(data.pillarScores).map(([pillar, scores]) => `
                <tr>
                    <td style="border: 1px solid #e5e5e5; padding: 12px;">${pillar}</td>
                    <td style="border: 1px solid #e5e5e5; padding: 12px; text-align: center;">${scores.score}/${scores.maxScore}</td>
                    <td style="border: 1px solid #e5e5e5; padding: 12px; text-align: center;">${scores.percentage}%</td>
                    <td style="border: 1px solid #e5e5e5; padding: 12px; text-align: center;">
                        <span class="level-badge level-${scores.level}">${scores.level}</span>
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
  }

  /**
   * Generate recommendations section
   */
  private generateRecommendations(data: AuditReportData): string {
    const highPriority = data.recommendations.filter(r => r.priority === 'high');
    const mediumPriority = data.recommendations.filter(r => r.priority === 'medium');
    const lowPriority = data.recommendations.filter(r => r.priority === 'low');

    return `
    <div class="page">
        <h1>Recommendations & Action Plan</h1>
        
        <p>Based on your assessment results, we've identified ${data.recommendations.length} key recommendations 
        to enhance your agent readiness. These are prioritized by impact and urgency.</p>
        
        ${highPriority.length > 0 ? `
        <h2>High Priority (Immediate Action Required)</h2>
        ${highPriority.map(rec => `
        <div class="recommendation high">
            <h3>${rec.title}</h3>
            <p><strong>Category:</strong> ${rec.category}</p>
            <p><strong>Description:</strong> ${rec.description}</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                <div>
                    <strong>Estimated Effort:</strong> ${rec.estimatedEffort}
                </div>
                <div>
                    <strong>Expected Impact:</strong> ${rec.expectedImpact}
                </div>
            </div>
        </div>
        `).join('')}
        ` : ''}
        
        ${mediumPriority.length > 0 ? `
        <h2>Medium Priority (Plan for Next Quarter)</h2>
        ${mediumPriority.map(rec => `
        <div class="recommendation medium">
            <h3>${rec.title}</h3>
            <p><strong>Category:</strong> ${rec.category}</p>
            <p><strong>Description:</strong> ${rec.description}</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                <div>
                    <strong>Estimated Effort:</strong> ${rec.estimatedEffort}
                </div>
                <div>
                    <strong>Expected Impact:</strong> ${rec.expectedImpact}
                </div>
            </div>
        </div>
        `).join('')}
        ` : ''}
        
        ${lowPriority.length > 0 ? `
        <h2>Low Priority (Future Considerations)</h2>
        ${lowPriority.map(rec => `
        <div class="recommendation low">
            <h3>${rec.title}</h3>
            <p><strong>Category:</strong> ${rec.category}</p>
            <p><strong>Description:</strong> ${rec.description}</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                <div>
                    <strong>Estimated Effort:</strong> ${rec.estimatedEffort}
                </div>
                <div>
                    <strong>Expected Impact:</strong> ${rec.expectedImpact}
                </div>
            </div>
        </div>
        `).join('')}
        ` : ''}
    </div>`;
  }

  /**
   * Generate action plan
   */
  private generateActionPlan(data: AuditReportData): string {
    return `
    <div class="page">
        <h1>90-Day Action Plan</h1>
        
        <p>This action plan provides a structured approach to implementing the recommendations from your 
        Agent Readiness Audit. The plan is organized into 30-day phases for manageable execution.</p>
        
        <h2>Phase 1: Foundation (Days 1-30)</h2>
        <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 20px 0;">
            <h3>Focus: Infrastructure & Immediate Actions</h3>
            <ul>
                ${data.recommendations
                  .filter(r => r.priority === 'high')
                  .slice(0, 3)
                  .map(rec => `<li><strong>${rec.title}</strong> (${rec.estimatedEffort})</li>`)
                  .join('')}
            </ul>
        </div>
        
        <h2>Phase 2: Enhancement (Days 31-60)</h2>
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0;">
            <h3>Focus: Process Improvement & Integration</h3>
            <ul>
                ${data.recommendations
                  .filter(r => r.priority === 'medium')
                  .slice(0, 3)
                  .map(rec => `<li><strong>${rec.title}</strong> (${rec.estimatedEffort})</li>`)
                  .join('')}
            </ul>
        </div>
        
        <h2>Phase 3: Optimization (Days 61-90)</h2>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0;">
            <h3>Focus: Advanced Features & Fine-tuning</h3>
            <ul>
                ${data.recommendations
                  .filter(r => r.priority === 'low')
                  .slice(0, 3)
                  .map(rec => `<li><strong>${rec.title}</strong> (${rec.estimatedEffort})</li>`)
                  .join('')}
            </ul>
        </div>
        
        <h2>Success Metrics</h2>
        <ul>
            <li>Improved readiness score by 20+ points</li>
            <li>All high-priority recommendations addressed</li>
            <li>Successful pilot agent deployment</li>
            <li>Team training completed</li>
            <li>Updated policies and procedures in place</li>
        </ul>
    </div>`;
  }

  /**
   * Generate benchmarks section
   */
  private generateBenchmarks(data: AuditReportData): string {
    if (!data.industryBenchmark) {
      return '';
    }

    return `
    <div class="page">
        <h1>Industry Benchmarks</h1>
        
        <div class="benchmark-comparison">
            <h2>Industry Comparison: ${data.industryBenchmark.industry}</h2>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; margin: 30px 0;">
                <div style="text-align: center;">
                    <div style="font-size: 14px; color: #666;">Your Score</div>
                    <div class="benchmark-score">${data.totalScore}</div>
                    <div style="font-size: 14px; color: #666;">out of ${data.maxPossibleScore}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 14px; color: #666;">Industry Average</div>
                    <div class="benchmark-score" style="color: #666;">${data.industryBenchmark.averageScore}</div>
                    <div style="font-size: 14px; color: #666;">out of ${data.maxPossibleScore}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 14px; color: #666;">Your Percentile</div>
                    <div class="benchmark-score">${data.industryBenchmark.percentile}th</div>
                    <div style="font-size: 14px; color: #666;">percentile</div>
                </div>
            </div>
        </div>
        
        <h3>Benchmark Analysis</h3>
        <p>Your organization scored <strong>${data.industryBenchmark.comparison}</strong> the industry average, 
        placing you in the <strong>${data.industryBenchmark.percentile}th percentile</strong> of ${data.industryBenchmark.industry} 
        companies assessed for agent readiness.</p>
        
        <div class="chart-container">
            <canvas id="benchmarkChart"></canvas>
        </div>
        
        <h3>Competitive Positioning</h3>
        <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px;">
            ${this.getBenchmarkInsights(data.industryBenchmark.percentile)}
        </div>
    </div>`;
  }

  /**
   * Generate methodology section
   */
  private generateMethodology(data: AuditReportData): string {
    return `
    <div class="page">
        <h1>Assessment Methodology</h1>
        
        <h2>Overview</h2>
        <p>The Agent Readiness Audit is a comprehensive evaluation framework designed to assess an organization's 
        preparedness for implementing AI agents. The assessment covers multiple dimensions of readiness across 
        technical, operational, and strategic areas.</p>
        
        <h2>Assessment Framework</h2>
        <div class="score-grid">
            ${Object.entries(data.pillarScores).map(([pillar, scores]) => `
            <div class="pillar-card">
                <div class="pillar-title">${pillar}</div>
                <p style="font-size: 12px; color: #666; margin: 10px 0;">
                    ${scores.questions} evaluation criteria covering ${this.getPillarDescription(pillar)}
                </p>
            </div>
            `).join('')}
        </div>
        
        <h2>Scoring Methodology</h2>
        <ul>
            <li><strong>Question Weighting:</strong> Each question is weighted based on its impact on agent readiness</li>
            <li><strong>Pillar Scoring:</strong> Pillar scores are calculated as weighted averages of constituent questions</li>
            <li><strong>Overall Score:</strong> Total score reflects the aggregate readiness across all pillars</li>
            <li><strong>Maturity Levels:</strong> Scores are mapped to maturity levels (Beginner, Developing, Proficient, Advanced, Expert)</li>
        </ul>
        
        <h2>Maturity Level Definitions</h2>
        <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px;">
            <div style="margin: 15px 0;">
                <span class="level-badge level-beginner">Beginner</span>
                <span style="margin-left: 15px;">0-40% - Limited capabilities, significant gaps</span>
            </div>
            <div style="margin: 15px 0;">
                <span class="level-badge level-developing">Developing</span>
                <span style="margin-left: 15px;">41-60% - Basic capabilities, some processes in place</span>
            </div>
            <div style="margin: 15px 0;">
                <span class="level-badge level-proficient">Proficient</span>
                <span style="margin-left: 15px;">61-80% - Good capabilities, established processes</span>
            </div>
            <div style="margin: 15px 0;">
                <span class="level-badge level-advanced">Advanced</span>
                <span style="margin-left: 15px;">81-95% - Strong capabilities, optimized processes</span>
            </div>
            <div style="margin: 15px 0;">
                <span class="level-badge level-expert">Expert</span>
                <span style="margin-left: 15px;">96-100% - Exceptional capabilities, industry-leading practices</span>
            </div>
        </div>
    </div>`;
  }

  /**
   * Generate appendix
   */
  private generateAppendix(data: AuditReportData): string {
    return `
    <div class="page">
        <h1>Appendix</h1>
        
        <h2>A. Detailed Answer Summary</h2>
        <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px;">
            ${this.generateDetailedAnswers(data.answers)}
        </div>
        
        <h2>B. Glossary</h2>
        <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px;">
            <dl>
                <dt><strong>Agent Readiness</strong></dt>
                <dd>The organizational capability to successfully deploy, manage, and scale AI agents</dd>
                
                <dt><strong>Technical Readiness</strong></dt>
                <dd>Infrastructure, architecture, and technical capabilities required for agent deployment</dd>
                
                <dt><strong>Operational Readiness</strong></dt>
                <dd>Processes, governance, and operational capabilities to manage AI agents effectively</dd>
                
                <dt><strong>AI Agent</strong></dt>
                <dd>Autonomous software systems that can perceive their environment and take actions to achieve goals</dd>
            </dl>
        </div>
        
        <h2>C. Resources and Next Steps</h2>
        <ul>
            <li>Agent Readiness Assessment Framework Documentation</li>
            <li>Implementation Best Practices Guide</li>
            <li>Technology Vendor Evaluation Criteria</li>
            <li>Training and Certification Programs</li>
            <li>Community and Support Resources</li>
        </ul>
        
        <div class="footer">
            <p>Agent Readiness Audit Report - ${data.organizationName}</p>
            <p>Generated on ${new Date(data.generatedAt).toLocaleDateString()} | Version ${data.version}</p>
            <p>© 2024 Agent Readiness Assessment Platform</p>
        </div>
    </div>`;
  }

  /**
   * Generate Chart.js code for visualizations
   */
  private generateChartJS(data: AuditReportData): string {
    const pillarData = Object.entries(data.pillarScores).map(([name, scores]) => ({
      label: name,
      value: scores.percentage
    }));

    return `
        // Overall Performance Chart
        const overallCtx = document.getElementById('overallChart');
        if (overallCtx) {
            new Chart(overallCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Achieved', 'Remaining'],
                    datasets: [{
                        data: [${data.totalScore}, ${data.maxPossibleScore - data.totalScore}],
                        backgroundColor: ['#3b82f6', '#e5e7eb'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: { 
                            display: true, 
                            text: '${data.totalScore}/${data.maxPossibleScore} (${Math.round((data.totalScore / data.maxPossibleScore) * 100)}%)',
                            font: { size: 24, weight: 'bold' }
                        }
                    }
                }
            });
        }
        
        // Pillar Comparison Chart
        const pillarCtx = document.getElementById('pillarChart');
        if (pillarCtx) {
            new Chart(pillarCtx, {
                type: 'radar',
                data: {
                    labels: [${pillarData.map(p => `'${p.label}'`).join(',')}],
                    datasets: [{
                        label: 'Your Score',
                        data: [${pillarData.map(p => p.value).join(',')}],
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { stepSize: 20 }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
        
        // Benchmark Chart
        const benchmarkCtx = document.getElementById('benchmarkChart');
        if (benchmarkCtx) {
            new Chart(benchmarkCtx, {
                type: 'bar',
                data: {
                    labels: ['Your Organization', 'Industry Average'],
                    datasets: [{
                        data: [${data.totalScore}, ${data.industryBenchmark?.averageScore || 0}],
                        backgroundColor: ['#3b82f6', '#9ca3af'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, max: ${data.maxPossibleScore} }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
    `;
  }

  /**
   * Helper methods
   */
  private getDefaultTemplate(): PDFTemplate {
    return {
      id: 'default',
      name: 'Standard Report',
      description: 'Professional audit report template',
      type: 'standard',
      components: {
        coverPage: true,
        executiveSummary: true,
        scoreOverview: true,
        pillarAnalysis: true,
        detailedFindings: true,
        recommendations: true,
        actionPlan: true,
        benchmarks: true,
        methodology: true,
        appendix: true,
      },
      styling: {
        primaryColor: '#3b82f6',
        secondaryColor: '#1e40af',
        fontFamily: 'Inter',
        logoPosition: 'top-left',
        headerStyle: 'modern',
      },
    };
  }

  private getOverallReadinessLevel(score: number, maxScore: number): string {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 96) return 'Expert';
    if (percentage >= 81) return 'Advanced';
    if (percentage >= 61) return 'Proficient';
    if (percentage >= 41) return 'Developing';
    return 'Beginner';
  }

  private getPillarAnalysis(pillar: string, scores: any): string {
    const percentage = scores.percentage;
    const level = scores.level;
    
    if (percentage >= 80) {
      return `Your organization demonstrates strong capabilities in ${pillar} with a ${level} level of maturity. This area is well-positioned to support agent implementation.`;
    } else if (percentage >= 60) {
      return `Your organization shows good progress in ${pillar} with ${level} capabilities. Some enhancements will help optimize this area for agent readiness.`;
    } else {
      return `${pillar} represents an opportunity for improvement. With ${level} capabilities currently, focused attention in this area will significantly enhance agent readiness.`;
    }
  }

  private getPillarDescription(pillar: string): string {
    const descriptions: Record<string, string> = {
      'Technical Readiness': 'infrastructure, architecture, and integration capabilities',
      'Operational Readiness': 'processes, governance, and operational maturity',
      'Security & Compliance': 'security posture, compliance, and risk management',
      'Data & Analytics': 'data quality, analytics capabilities, and insights maturity',
      'Team & Skills': 'talent, skills, and organizational readiness'
    };
    return descriptions[pillar] || 'core readiness capabilities';
  }

  private getBenchmarkInsights(percentile: number): string {
    if (percentile >= 90) {
      return `<p><strong>Industry Leader:</strong> Your organization is among the top 10% of companies in agent readiness. You're well-positioned to be an early adopter and competitive differentiator.</p>`;
    } else if (percentile >= 75) {
      return `<p><strong>Above Average:</strong> Your organization outperforms most peers in agent readiness. Focus on optimization to join the industry leaders.</p>`;
    } else if (percentile >= 50) {
      return `<p><strong>Market Average:</strong> Your organization aligns with typical industry readiness levels. Strategic improvements will help gain competitive advantage.</p>`;
    } else {
      return `<p><strong>Development Opportunity:</strong> Your organization has significant opportunity to improve agent readiness. Focus on foundational capabilities first.</p>`;
    }
  }

  private generateKeyAnswersSummary(answers: Record<string, any>): string {
    const keyAnswers = Object.entries(answers).slice(0, 10);
    return keyAnswers.map(([question, answer]) => 
      `<p><strong>${question}:</strong> ${typeof answer === 'object' ? JSON.stringify(answer) : answer}</p>`
    ).join('');
  }

  private generateDetailedAnswers(answers: Record<string, any>): string {
    return Object.entries(answers).map(([question, answer]) => 
      `<div style="margin: 15px 0;"><strong>${question}:</strong><br/>${typeof answer === 'object' ? JSON.stringify(answer, null, 2) : answer}</div>`
    ).join('');
  }
}

// Export singleton instance
export const reportTemplateService = new ReportTemplateService();