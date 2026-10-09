import { chromium } from 'playwright';
import fs from 'fs';

const mockData = {
  productIntelligence: {
    product: {
      name: "Growwwly",
      category: "Growth Intelligence Tool",
      description: "AI-powered growth intelligence for SaaS founders. Evaluates product, customers, and market to determine the highest-leverage acquisition channel."
    },
    growthContext: {
      currentStage: "Pre-Product Market Fit",
      likelyAcquisitionMotion: "Sales-led",
      expectedSalesCycle: "Medium (1-3 months)",
      estimatedCustomerValue: "$2,000 - $10,000"
    },
    constraints: {
      budgetLevel: "Low",
      timeToResultsRequired: "Fast"
    },
    confidence: {
      overall: 92,
      reasoning: "The product description and target customer are well-defined, allowing for high confidence in the recommended acquisition motion."
    }
  },
  websiteIntelligence: null,
  growthIntelligence: {
    highestLeverageAction: {
      title: "Launch a targeted Cold Email outreach campaign to B2B SaaS Founders",
      reason: "Cold email allows you to directly reach your precise target audience (B2B SaaS founders) with personalized messaging, requiring very little budget and yielding fast feedback loops essential for early-stage validation.",
      decisionType: "commit",
      opportunityScore: 88,
      channel: "outbound",
      expectedImpact: "High",
      effortLabel: "Medium",
      evidence: [
        "Founders are easily identifiable on platforms like Apollo or LinkedIn.",
        "Low budget constraint favors low-cost outbound over paid media.",
        "Direct feedback loop accelerates iteration on positioning."
      ]
    }
  }
};

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();
  
  try {
    // Navigate to a blank page on the same origin first to set sessionStorage
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    
    await page.evaluate((data) => {
      sessionStorage.setItem('growwwly:last-analysis:v3', JSON.stringify(data));
    }, mockData);
    
    // Now navigate to the dashboard
    await page.goto('http://localhost:3000/app', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for animations
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'docs/screenshots/dashboard.png' });
    console.log('Dashboard captured.');
  } catch (err) {
    console.error('Error capturing dashboard:', err);
  }

  await browser.close();
})();
