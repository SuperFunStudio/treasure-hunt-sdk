import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import FirebaseService from '../services/FirebaseService';

const DashboardScreen = ({navigation}: any) => {
  const [user, setUser] = useState<any>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);

  useEffect(() => {
    const currentUser = FirebaseService.getCurrentUser();
    setUser(currentUser);
    loadRecentScans();
  }, []);

  const loadRecentScans = async () => {
    // TODO: Implement fetching recent scans from Firestore
    setRecentScans([]);
  };

  const handleSignOut = async () => {
    try {
      await FirebaseService.signOut();
      navigation.replace('SignIn');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleNewScan = () => {
    navigation.navigate('Camera');
  };

  const renderScanItem = ({item}: any) => (
    <TouchableOpacity
      style={styles.scanCard}
      onPress={() =>
        navigation.navigate('AnalysisResult', {analysisId: item.id})
      }>
      <Image source={{uri: item.imageUrl}} style={styles.scanImage} />
      <View style={styles.scanInfo}>
        <Text style={styles.scanTitle}>{item.category || 'Unknown'}</Text>
        <Text style={styles.scanPrice}>
          ${item.estimatedPrice || '0.00'}
        </Text>
        <Text style={styles.scanDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome, {user?.email?.split('@')[0] || 'User'}!
        </Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.scanButton} onPress={handleNewScan}>
        <Text style={styles.scanButtonText}>📸 Scan New Item</Text>
      </TouchableOpacity>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Scans</Text>
        {recentScans.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No scans yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the button above to scan your first item!
            </Text>
          </View>
        ) : (
          <FlatList
            data={recentScans}
            renderItem={renderScanItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.scanList}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  signOutText: {
    color: '#4CAF50',
    fontSize: 16,
  },
  scanButton: {
    backgroundColor: '#4CAF50',
    padding: 20,
    margin: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  recentSection: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },
  scanList: {
    paddingBottom: 20,
  },
  scanCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scanImage: {
    width: 100,
    height: 100,
    backgroundColor: '#e0e0e0',
  },
  scanInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  scanTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  scanPrice: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  scanDate: {
    fontSize: 12,
    color: '#999',
  },
});

export default DashboardScreen;
