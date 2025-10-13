import FirebaseService from './FirebaseService';

interface ProgressUpdate {
  phase: 'uploading' | 'preliminary' | 'pricing' | 'complete';
  message: string;
  progress: number;
  data?: any;
}

interface AnalysisOptions {
  onProgress?: (update: ProgressUpdate) => void;
  onComplete?: (data: any) => void;
  onError?: (error: any) => void;
  pollInterval?: number;
  maxPolls?: number;
}

class AnalysisService {
  private baseUrl: string;
  private pollInterval: number = 2000;
  private maxPolls: number = 30;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async analyzeImages(
    imageUris: string[],
    options: AnalysisOptions = {}
  ): Promise<void> {
    const {
      onProgress,
      onComplete,
      onError,
      pollInterval = this.pollInterval,
      maxPolls = this.maxPolls,
    } = options;

    try {
      // Get auth token
      const token = await FirebaseService.getAuthToken();

      // Phase 1: Upload images
      onProgress?.({
        phase: 'uploading',
        message: 'Uploading images...',
        progress: 10,
      });

      const formData = new FormData();

      for (let i = 0; i < imageUris.length; i++) {
        formData.append('images', {
          uri: imageUris[i],
          type: 'image/jpeg',
          name: `image_${i}.jpg`,
        } as any);
      }

      const uploadResponse = await fetch(`${this.baseUrl}/api/analyze-progressive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();
      const analysisId = uploadResult.analysisId;

      onProgress?.({
        phase: 'uploading',
        message: 'Upload complete. Analyzing...',
        progress: 30,
      });

      // Phase 2: Poll for results
      let pollCount = 0;
      let preliminaryShown = false;

      const pollResults = async (): Promise<void> => {
        if (pollCount >= maxPolls) {
          onError?.({
            phase: 'polling',
            error: 'Analysis timeout',
          });
          return;
        }

        try {
          const statusResponse = await fetch(
            `${this.baseUrl}/api/analyze-progressive/${analysisId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            }
          );

          if (!statusResponse.ok) {
            throw new Error(`Status check failed: ${statusResponse.status}`);
          }

          const result = await statusResponse.json();

          // Show preliminary results (Phase 1)
          if (result.phase === 'preliminary' && !preliminaryShown) {
            preliminaryShown = true;
            onProgress?.({
              phase: 'preliminary',
              message: 'Initial analysis complete',
              progress: 50,
              data: result,
            });
          }

          // Show pricing progress (Phase 2)
          if (result.phase === 'pricing') {
            onProgress?.({
              phase: 'pricing',
              message: 'Analyzing market pricing...',
              progress: 50 + (pollCount / maxPolls) * 40,
            });
          }

          // Complete
          if (result.phase === 'complete') {
            onProgress?.({
              phase: 'complete',
              message: 'Analysis complete',
              progress: 100,
            });
            onComplete?.(result);
            return;
          }

          // Continue polling
          pollCount++;
          setTimeout(pollResults, pollInterval);
        } catch (error) {
          onError?.({
            phase: 'polling',
            error: error.message,
          });
        }
      };

      // Start polling
      await pollResults();
    } catch (error) {
      onError?.({
        phase: 'analysis',
        error: error.message,
      });
    }
  }

  async getAnalysisHistory(userId: string): Promise<any[]> {
    try {
      const token = await FirebaseService.getAuthToken();
      const response = await fetch(`${this.baseUrl}/api/analysis/history?userId=${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get history: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get analysis history error:', error);
      throw error;
    }
  }
}

export default AnalysisService;
