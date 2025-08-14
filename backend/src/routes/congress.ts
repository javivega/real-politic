import { Router, Request, Response } from 'express';
import { CongressDataService } from '../services/CongressDataService';
import { ApiResponse, CongressUpdateResult } from '../types';

const router = Router();
const congressService = new CongressDataService();

// GET /api/congress/update - Trigger Congress data update
router.get('/update', async (req: Request, res: Response) => {
  try {
    console.log('Congress data update requested');
    
    const result = await congressService.processCongressData();
    
    const response: ApiResponse<CongressUpdateResult> = {
      success: true,
      message: 'Congress data update completed successfully',
      data: result
    };
    
    res.json(response);
  } catch (error) {
    console.error('Congress data update failed:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Congress data update failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.status(500).json(response);
  }
});

// GET /api/congress/status - Get Congress data processing status
router.get('/status', async (req: Request, res: Response) => {
  try {
    // This could be enhanced to check actual processing status
    const response: ApiResponse = {
      success: true,
      message: 'Congress data service is running',
      data: {
        service: 'Congress Data Service',
        status: 'active',
        lastUpdate: new Date().toISOString()
      }
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: 'Failed to get Congress service status',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.status(500).json(response);
  }
});

// POST /api/congress/update - Alternative endpoint for triggering updates
router.post('/update', async (req: Request, res: Response) => {
  try {
    console.log('Congress data update requested via POST');
    
    const result = await congressService.processCongressData();
    
    const response: ApiResponse<CongressUpdateResult> = {
      success: true,
      message: 'Congress data update completed successfully',
      data: result
    };
    
    res.json(response);
  } catch (error) {
    console.error('Congress data update failed:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Congress data update failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.status(500).json(response);
  }
});

export default router; 