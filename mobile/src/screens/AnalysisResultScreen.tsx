import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AnalysisService from '../services/AnalysisService';

const AnalysisResultScreen = ({route, navigation}: any) => {
  const {images} = route.params;
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('uploading');
  const [preliminaryData, setPreliminaryData] = useState<any>(null);
  const [finalData, setFinalData] = useState<any>(null);

  useEffect(() => {
    analyzeImages();
  }, []);

  const analyzeImages = async () => {
    // Use your Firebase Cloud Functions URL
    const baseUrl = 'https://YOUR-PROJECT.cloudfunctions.net';
    const analysisService = new AnalysisService(baseUrl);

    const imageUris = images.map((img: any) => img.uri);

    await analysisService.analyzeImages(imageUris, {
      onProgress: update => {
        setProgress(update.progress);
        setPhase(update.phase);

        if (update.phase === 'preliminary' && update.data) {
          setPreliminaryData(update.data);
        }
      },
      onComplete: data => {
        setFinalData(data);
        setLoading(false);
      },
      onError: error => {
        Alert.alert('Analysis Error', error.error || 'Failed to analyze images');
        setLoading(false);
      },
    });
  };

  const getPhaseMessage = () => {
    switch (phase) {
      case 'uploading':
        return 'Uploading images...';
      case 'preliminary':
        return 'Initial analysis complete!';
      case 'pricing':
        return 'Getting market pricing...';
      case 'complete':
        return 'Analysis complete!';
      default:
        return 'Processing...';
    }
  };

  const handleCreateListing = () => {
    if (!finalData && !preliminaryData) {
      Alert.alert('Error', 'No analysis data available');
      return;
    }

    navigation.navigate('ListingPreview', {
      analysisData: finalData || preliminaryData,
    });
  };

  const data = finalData || preliminaryData;

  return (
    <ScrollView style={styles.container}>
      {loading || !data ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>{getPhaseMessage()}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {width: `${progress}%`}]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      ) : (
        <View style={styles.resultContainer}>
          {/* Images */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {images.map((image: any, index: number) => (
              <Image
                key={index}
                source={{uri: image.uri}}
                style={styles.resultImage}
              />
            ))}
          </ScrollView>

          {/* Analysis Results */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Category:</Text>
              <Text style={styles.detailValue}>
                {data.analysis?.category || 'Unknown'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Brand:</Text>
              <Text style={styles.detailValue}>
                {data.analysis?.brand || 'Unknown'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Condition:</Text>
              <Text style={styles.detailValue}>
                {data.analysis?.condition?.rating || 'Unknown'}
              </Text>
            </View>
          </View>

          {/* Pricing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estimated Value</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.priceValue}>
                ${data.routes?.recommendedRoute?.estimatedReturn || '0.00'}
              </Text>
              {!finalData && (
                <View style={styles.loadingBadge}>
                  <ActivityIndicator size="small" color="#4CAF50" />
                  <Text style={styles.loadingBadgeText}>
                    Getting market data...
                  </Text>
                </View>
              )}
              {finalData && data.marketInsights && (
                <Text style={styles.priceSource}>
                  Based on {data.marketInsights.sampleSize} recent sales
                </Text>
              )}
            </View>
          </View>

          {/* Recommended Route */}
          {data.routes?.recommendedRoute && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recommendation</Text>
              <Text style={styles.routeText}>
                {data.routes.recommendedRoute.route === 'ebay'
                  ? '📦 List on eBay for best return'
                  : data.routes.recommendedRoute.route === 'donate'
                  ? '🎁 Consider donating'
                  : '♻️ Recycle this item'}
              </Text>
              {data.routes.recommendedRoute.reasoning && (
                <Text style={styles.reasoningText}>
                  {data.routes.recommendedRoute.reasoning}
                </Text>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateListing}>
              <Text style={styles.primaryButtonText}>Create eBay Listing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Dashboard')}>
              <Text style={styles.secondaryButtonText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
    marginTop: 20,
    marginBottom: 20,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  resultContainer: {
    padding: 20,
  },
  resultImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#e0e0e0',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  priceContainer: {
    alignItems: 'center',
  },
  priceValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  loadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  loadingBadgeText: {
    fontSize: 12,
    color: '#666',
  },
  priceSource: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  reasoningText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  actionButtons: {
    marginTop: 30,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AnalysisResultScreen;
