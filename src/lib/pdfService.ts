// PDF Generation Service for Task 2.3
// Handles automated PDF report generation with queue processing

import puppeteer, { Browser, Page } from 'puppeteer';
import type { 
  PDFJob, 
  AuditReportData, 
  PDFTemplate, 
  PDFGenerationOptions, 
  PDFJobResult,
  ChartData,
  PDFCustomizations
} from '../types/pdf';
import { reportTemplateService } from './reportTemplateService';
import { storage } from './storage';

export class PDFGenerationService {
  private browser: Browser | null = null;
  private isInitialized = false;

  constructor() {}

  // Initialize Puppeteer browser
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-default-apps',
        ],
      });
      
      this.isInitialized = true;
      console.log('PDF Generation Service initialized');
    } catch (error) {
      console.error('Failed to initialize PDF service:', error);
      throw error;
    }
  }

  // Clean up resources
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
      console.log('PDF Generation Service cleaned up');
    }
  }

  // Generate PDF report from audit data
  async generateReport(
    reportData: AuditReportData,
    template: PDFTemplate,
    customizations: PDFCustomizations,
    options: PDFGenerationOptions = this.getDefaultOptions()
  ): Promise<Buffer> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      // Set viewport for consistent rendering
      await page.setViewport({ width: 1200, height: 1600 });

      // Generate HTML content using template service
      const htmlContent = reportTemplateService.generateReportHTML(reportData, template);
      
      // Set content and wait for rendering
      await page.setContent(htmlContent, { 
        waitUntil: ['networkidle0', 'domcontentloaded'] 
      });

      // Add custom CSS if needed
      await this.injectCustomStyles(page, template, customizations);

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: options.format,
        landscape: options.orientation === 'landscape',
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  // Generate HTML content for PDF
  private async generateHTML(
    reportData: AuditReportData,
    template: PDFTemplate,
    customizations: PDFCustomizations
  ): Promise<string> {
    const chartData = this.generateChartData(reportData);
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Agent Readiness Audit Report</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        ${this.generateCSS(template, customizations)}
      </style>
    </head>
    <body>
      ${await this.generateCoverPage(reportData, customizations)}
      ${customizations.includeExecutiveSummary ? await this.generateExecutiveSummary(reportData) : ''}
      ${await this.generateScoreOverview(reportData, chartData)}
      ${customizations.includeDetailedScoring ? await this.generateDetailedScoring(reportData, chartData) : ''}
      ${customizations.includeRecommendations ? await this.generateRecommendations(reportData) : ''}
      ${customizations.includeActionPlan ? await this.generateActionPlan(reportData) : ''}
      ${customizations.includeBenchmarks ? await this.generateBenchmarks(reportData) : ''}
      ${customizations.includeAppendix ? await this.generateAppendix(reportData) : ''}
    </body>
    </html>
    `;
  }

  // Generate chart data for visualizations
  private generateChartData(reportData: AuditReportData): ChartData[] {
    const charts: ChartData[] = [];

    // Pillar scores radar chart
    const pillarLabels = Object.keys(reportData.pillarScores);
    const pillarScores = pillarLabels.map(pillar => reportData.pillarScores[pillar].percentage);

    charts.push({
      type: 'radar',
      title: 'Readiness Score by Pillar',
      data: {
        labels: pillarLabels,
        datasets: [{
          label: 'Your Score',
          data: pillarScores,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Readiness Score by Pillar' }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { stepSize: 20 }
          }
        }
      }
    });

    // Pillar scores bar chart
    charts.push({
      type: 'bar',
      title: 'Detailed Pillar Breakdown',
      data: {
        labels: pillarLabels,
        datasets: [{
          label: 'Score (%)',
          data: pillarScores,
          backgroundColor: pillarScores.map(score => 
            score >= 80 ? '#10B981' : 
            score >= 60 ? '#F59E0B' : 
            score >= 40 ? '#F97316' : '#EF4444'
          ),
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Detailed Pillar Breakdown' }
        },
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });

    // Overall score gauge (implemented as doughnut)
    const overallPercentage = (reportData.totalScore / reportData.maxPossibleScore) * 100;
    charts.push({
      type: 'doughnut',
      title: 'Overall Readiness Score',
      data: {
        labels: ['Achieved', 'Remaining'],
        datasets: [{
          label: 'Readiness Score',
          data: [overallPercentage, 100 - overallPercentage],
          backgroundColor: ['#10B981', '#E5E7EB'],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `Overall Score: ${Math.round(overallPercentage)}%` }
        }
      }
    });

    return charts;
  }

  // Generate CSS styles for PDF
  private generateCSS(template: PDFTemplate, customizations: PDFCustomizations): string {
    const primaryColor = customizations.brandColor || template.styling.primaryColor;
    
    return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${template.styling.fontFamily}, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #374151;
      background: white;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: linear-gradient(135deg, ${primaryColor}, ${this.lightenColor(primaryColor, 20)});
      color: white;
      padding: 2rem;
    }
    
    .cover-title {
      font-size: 3rem;
      font-weight: bold;
      margin-bottom: 1rem;
    }
    
    .cover-subtitle {
      font-size: 1.5rem;
      margin-bottom: 2rem;
      opacity: 0.9;
    }
    
    .cover-organization {
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }
    
    .cover-date {
      font-size: 1rem;
      opacity: 0.8;
    }
    
    .section {
      padding: 2rem;
      margin-bottom: 2rem;
    }
    
    .section-title {
      font-size: 2rem;
      font-weight: bold;
      color: ${primaryColor};
      margin-bottom: 1.5rem;
      border-bottom: 3px solid ${primaryColor};
      padding-bottom: 0.5rem;
    }
    
    .score-overview {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 2rem;
    }
    
    .score-card {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
    }
    
    .score-number {
      font-size: 3rem;
      font-weight: bold;
      color: ${primaryColor};
      margin-bottom: 0.5rem;
    }
    
    .score-label {
      font-size: 1.125rem;
      color: #6B7280;
    }
    
    .chart-container {
      width: 100%;
      height: 400px;
      margin: 2rem 0;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .pillar-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }
    
    .pillar-card {
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    .pillar-title {
      font-size: 1.25rem;
      font-weight: bold;
      margin-bottom: 1rem;
      color: ${primaryColor};
    }
    
    .pillar-score {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
    }
    
    .pillar-level {
      font-size: 0.875rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      display: inline-block;
      margin-bottom: 1rem;
    }
    
    .level-expert { background: #D1FAE5; color: #065F46; }
    .level-advanced { background: #DBEAFE; color: #1E40AF; }
    .level-proficient { background: #FEF3C7; color: #92400E; }
    .level-developing { background: #FED7AA; color: #9A3412; }
    .level-beginner { background: #FEE2E2; color: #991B1B; }
    
    .recommendations {
      margin: 2rem 0;
    }
    
    .recommendation {
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      border-left: 4px solid ${primaryColor};
    }
    
    .recommendation-title {
      font-size: 1.125rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
      color: ${primaryColor};
    }
    
    .recommendation-meta {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      color: #6B7280;
    }
    
    .priority-high { color: #DC2626; font-weight: bold; }
    .priority-medium { color: #D97706; font-weight: bold; }
    .priority-low { color: #059669; font-weight: bold; }
    
    .footer {
      text-align: center;
      padding: 2rem;
      border-top: 1px solid #E5E7EB;
      color: #6B7280;
      font-size: 0.875rem;
    }
    
    @media print {
      .chart-container {
        break-inside: avoid;
      }
      
      .pillar-card {
        break-inside: avoid;
      }
      
      .recommendation {
        break-inside: avoid;
      }
    }
    `;
  }

  // Generate cover page HTML
  private async generateCoverPage(reportData: AuditReportData, customizations: PDFCustomizations): Promise<string> {
    const overallPercentage = Math.round((reportData.totalScore / reportData.maxPossibleScore) * 100);
    
    return `
    <div class="cover-page">
      ${customizations.logoUrl ? `<img src="${customizations.logoUrl}" alt="Logo" style="max-height: 100px; margin-bottom: 2rem;">` : ''}
      <h1 class="cover-title">Agent Readiness Audit</h1>
      <h2 class="cover-subtitle">Comprehensive Assessment Report</h2>
      ${customizations.companyName ? `<p class="cover-organization">${customizations.companyName}</p>` : ''}
      <p class="cover-date">Generated on ${reportData.generatedAt.toLocaleDateString()}</p>
      <div style="margin-top: 3rem; padding: 2rem; background: rgba(255,255,255,0.1); border-radius: 12px;">
        <div style="font-size: 4rem; font-weight: bold; margin-bottom: 1rem;">${overallPercentage}%</div>
        <div style="font-size: 1.5rem;">Overall Readiness Score</div>
      </div>
    </div>
    `;
  }

  // Generate executive summary
  private async generateExecutiveSummary(reportData: AuditReportData): Promise<string> {
    const overallPercentage = Math.round((reportData.totalScore / reportData.maxPossibleScore) * 100);
    const readinessLevel = this.getReadinessLevel(overallPercentage);
    
    return `
    <div class="page-break"></div>
    <div class="section">
      <h2 class="section-title">Executive Summary</h2>
      
      <p style="font-size: 1.125rem; margin-bottom: 2rem; line-height: 1.8;">
        This report presents the results of a comprehensive Agent Readiness Audit conducted on ${reportData.completedAt.toLocaleDateString()}.
        The assessment evaluated your organization's preparedness for AI agent implementation across multiple critical dimensions.
      </p>
      
      <div class="score-overview">
        <div class="score-card">
          <div class="score-number">${overallPercentage}%</div>
          <div class="score-label">Overall Readiness</div>
        </div>
        <div class="score-card">
          <div class="score-number">${readinessLevel}</div>
          <div class="score-label">Readiness Level</div>
        </div>
      </div>
      
      <h3 style="font-size: 1.5rem; margin: 2rem 0 1rem 0; color: #374151;">Key Findings</h3>
      <ul style="list-style: none; padding: 0;">
        ${reportData.strengths.slice(0, 3).map(strength => 
          `<li style="margin-bottom: 0.5rem; padding-left: 1.5rem; position: relative;">
            <span style="position: absolute; left: 0; color: #10B981;">✓</span>
            ${strength}
          </li>`
        ).join('')}
      </ul>
      
      <h3 style="font-size: 1.5rem; margin: 2rem 0 1rem 0; color: #374151;">Areas for Improvement</h3>
      <ul style="list-style: none; padding: 0;">
        ${reportData.weaknesses.slice(0, 3).map(weakness => 
          `<li style="margin-bottom: 0.5rem; padding-left: 1.5rem; position: relative;">
            <span style="position: absolute; left: 0; color: #EF4444;">!</span>
            ${weakness}
          </li>`
        ).join('')}
      </ul>
    </div>
    `;
  }

  // Generate score overview section
  private async generateScoreOverview(reportData: AuditReportData, chartData: ChartData[]): Promise<string> {
    return `
    <div class="page-break"></div>
    <div class="section">
      <h2 class="section-title">Score Overview</h2>
      
      <div class="chart-container">
        <canvas id="radarChart" width="400" height="400"></canvas>
      </div>
      
      <div class="pillar-grid">
        ${Object.entries(reportData.pillarScores).map(([pillarName, pillarData]) => `
          <div class="pillar-card">
            <h3 class="pillar-title">${pillarName}</h3>
            <div class="pillar-score" style="color: ${this.getScoreColor(pillarData.percentage)}">${Math.round(pillarData.percentage)}%</div>
            <span class="pillar-level level-${pillarData.level}">${pillarData.level.toUpperCase()}</span>
            <p style="font-size: 0.875rem; color: #6B7280; margin-top: 1rem;">
              ${pillarData.completedQuestions} of ${pillarData.questions} questions completed
            </p>
          </div>
        `).join('')}
      </div>
      
      <script>
        // Initialize radar chart
        const radarCtx = document.getElementById('radarChart').getContext('2d');
        new Chart(radarCtx, ${JSON.stringify(chartData[0])});
      </script>
    </div>
    `;
  }

  // Generate detailed scoring section
  private async generateDetailedScoring(reportData: AuditReportData, chartData: ChartData[]): Promise<string> {
    return `
    <div class="page-break"></div>
    <div class="section">
      <h2 class="section-title">Detailed Scoring Analysis</h2>
      
      <div class="chart-container">
        <canvas id="barChart" width="600" height="300"></canvas>
      </div>
      
      ${Object.entries(reportData.pillarScores).map(([pillarName, pillarData]) => `
        <div style="margin: 2rem 0; padding: 1.5rem; border: 1px solid #E5E7EB; border-radius: 8px;">
          <h3 style="font-size: 1.25rem; font-weight: bold; margin-bottom: 1rem; color: #374151;">${pillarName}</h3>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <span style="font-size: 1.125rem;">Score: <strong>${Math.round(pillarData.percentage)}%</strong></span>
            <span class="pillar-level level-${pillarData.level}">${pillarData.level.toUpperCase()}</span>
          </div>
          <div style="background: #F3F4F6; border-radius: 4px; height: 8px; margin-bottom: 1rem;">
            <div style="background: ${this.getScoreColor(pillarData.percentage)}; height: 100%; width: ${pillarData.percentage}%; border-radius: 4px;"></div>
          </div>
          <p style="font-size: 0.875rem; color: #6B7280;">
            Based on ${pillarData.completedQuestions} completed questions out of ${pillarData.questions} total questions in this category.
          </p>
        </div>
      `).join('')}
      
      <script>
        // Initialize bar chart
        const barCtx = document.getElementById('barChart').getContext('2d');
        new Chart(barCtx, ${JSON.stringify(chartData[1])});
      </script>
    </div>
    `;
  }

  // Generate recommendations section
  private async generateRecommendations(reportData: AuditReportData): Promise<string> {
    return `
    <div class="page-break"></div>
    <div class="section">
      <h2 class="section-title">Recommendations</h2>
      
      <div class="recommendations">
        ${reportData.recommendations.map(rec => `
          <div class="recommendation">
            <h3 class="recommendation-title">${rec.title}</h3>
            <div class="recommendation-meta">
              <span class="priority-${rec.priority}">Priority: ${rec.priority.toUpperCase()}</span>
              <span>Category: ${rec.category}</span>
              <span>Effort: ${rec.estimatedEffort}</span>
              <span>Impact: ${rec.expectedImpact}</span>
            </div>
            <p>${rec.description}</p>
          </div>
        `).join('')}
      </div>
    </div>
    `;
  }

  // Generate action plan section
  private async generateActionPlan(reportData: AuditReportData): Promise<string> {
    const highPriorityRecs = reportData.recommendations.filter(r => r.priority === 'high');
    const mediumPriorityRecs = reportData.recommendations.filter(r => r.priority === 'medium');
    
    return `
    <div class="page-break"></div>
    <div class="section">
      <h2 class="section-title">Action Plan</h2>
      
      <h3 style="font-size: 1.5rem; margin: 2rem 0 1rem 0; color: #374151;">Immediate Actions (High Priority)</h3>
      <ol style="padding-left: 1.5rem;">
        ${highPriorityRecs.map(rec => `
          <li style="margin-bottom: 1rem;">
            <strong>${rec.title}</strong><br>
            <span style="color: #6B7280; font-size: 0.875rem;">${rec.estimatedEffort} • ${rec.expectedImpact}</span>
          </li>
        `).join('')}
      </ol>
      
      <h3 style="font-size: 1.5rem; margin: 2rem 0 1rem 0; color: #374151;">Next Steps (Medium Priority)</h3>
      <ol style="padding-left: 1.5rem;">
        ${mediumPriorityRecs.map(rec => `
          <li style="margin-bottom: 1rem;">
            <strong>${rec.title}</strong><br>
            <span style="color: #6B7280; font-size: 0.875rem;">${rec.estimatedEffort} • ${rec.expectedImpact}</span>
          </li>
        `).join('')}
      </ol>
    </div>
    `;
  }

  // Generate benchmarks section
  private async generateBenchmarks(reportData: AuditReportData): Promise<string> {
    if (!reportData.industryBenchmark) {
      return `
      <div class="page-break"></div>
      <div class="section">
        <h2 class="section-title">Industry Benchmarks</h2>
        <p>Industry benchmark data is not available for this assessment.</p>
      </div>
      `;
    }

    const benchmark = reportData.industryBenchmark;
    const overallPercentage = Math.round((reportData.totalScore / reportData.maxPossibleScore) * 100);
    
    return `
    <div class="page-break"></div>
    <div class="section">
      <h2 class="section-title">Industry Benchmarks</h2>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem; margin: 2rem 0;">
        <div class="score-card">
          <div class="score-number">${overallPercentage}%</div>
          <div class="score-label">Your Score</div>
        </div>
        <div class="score-card">
          <div class="score-number">${Math.round(benchmark.averageScore)}%</div>
          <div class="score-label">Industry Average</div>
        </div>
        <div class="score-card">
          <div class="score-number">${benchmark.percentile}th</div>
          <div class="score-label">Percentile</div>
        </div>
      </div>
      
      <p style="font-size: 1.125rem; margin: 2rem 0; text-align: center;">
        Your organization scores <strong>${benchmark.comparison}</strong> the ${benchmark.industry} industry average.
      </p>
    </div>
    `;
  }

  // Generate appendix section
  private async generateAppendix(reportData: AuditReportData): Promise<string> {
    return `
    <div class="page-break"></div>
    <div class="section">
      <h2 class="section-title">Appendix</h2>
      
      <h3 style="font-size: 1.25rem; margin: 2rem 0 1rem 0; color: #374151;">Assessment Methodology</h3>
      <p style="margin-bottom: 1rem;">
        This Agent Readiness Audit was conducted using a comprehensive framework that evaluates multiple dimensions
        of organizational readiness for AI agent implementation.
      </p>
      
      <h3 style="font-size: 1.25rem; margin: 2rem 0 1rem 0; color: #374151;">Scoring Method</h3>
      <ul style="padding-left: 1.5rem; margin-bottom: 2rem;">
        <li>Each question is weighted based on its importance to agent readiness</li>
        <li>Pillar scores are calculated as weighted averages of constituent questions</li>
        <li>Overall score represents the aggregate readiness across all pillars</li>
      </ul>
      
      <h3 style="font-size: 1.25rem; margin: 2rem 0 1rem 0; color: #374151;">Assessment Details</h3>
      <div style="font-size: 0.875rem; color: #6B7280;">
        <p>Session ID: ${reportData.sessionId}</p>
        <p>Assessment Version: ${reportData.version}</p>
        <p>Completed: ${reportData.completedAt.toLocaleString()}</p>
        <p>Total Questions: ${Object.values(reportData.pillarScores).reduce((sum, pillar) => sum + pillar.questions, 0)}</p>
        <p>Questions Answered: ${Object.values(reportData.pillarScores).reduce((sum, pillar) => sum + pillar.completedQuestions, 0)}</p>
      </div>
    </div>
    
    <div class="footer">
      <p>This report was generated by the Agent Readiness Audit system.</p>
      <p>For questions about this assessment, please contact your system administrator.</p>
    </div>
    `;
  }

  // Inject custom styles into page
  private async injectCustomStyles(page: Page, template: PDFTemplate, customizations: PDFCustomizations): Promise<void> {
    // Add any additional dynamic styles if needed
    await page.addStyleTag({
      content: `
        /* Additional custom styles can be injected here */
        @media print {
          body { -webkit-print-color-adjust: exact; }
        }
      `
    });
  }

  // Utility methods
  private getDefaultOptions(): PDFGenerationOptions {
    return {
      format: 'A4',
      orientation: 'portrait',
      quality: 'standard',
      compression: true,
    };
  }

  private getReadinessLevel(percentage: number): string {
    if (percentage >= 90) return 'Expert';
    if (percentage >= 80) return 'Advanced';
    if (percentage >= 60) return 'Proficient';
    if (percentage >= 40) return 'Developing';
    return 'Beginner';
  }

  private getScoreColor(percentage: number): string {
    if (percentage >= 80) return '#10B981'; // Green
    if (percentage >= 60) return '#F59E0B'; // Yellow
    if (percentage >= 40) return '#F97316'; // Orange
    return '#EF4444'; // Red
  }

  private lightenColor(color: string, percent: number): string {
    // Simple color lightening - in production, use a proper color manipulation library
    return color.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+).*\)/, (match, r, g, b) => {
      const newR = Math.min(255, parseInt(r) + Math.round((255 - parseInt(r)) * percent / 100));
      const newG = Math.min(255, parseInt(g) + Math.round((255 - parseInt(g)) * percent / 100));
      const newB = Math.min(255, parseInt(b) + Math.round((255 - parseInt(b)) * percent / 100));
      return `rgb(${newR}, ${newG}, ${newB})`;
    });
  }
}