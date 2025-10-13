import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';

const ListingPreviewScreen = ({route, navigation}: any) => {
  const {analysisData} = route.params;

  const [title, setTitle] = useState(analysisData.analysis?.title || '');
  const [description, setDescription] = useState(
    analysisData.analysis?.description || ''
  );
  const [price, setPrice] = useState(
    analysisData.routes?.recommendedRoute?.estimatedReturn?.toString() || '0'
  );
  const [loading, setLoading] = useState(false);

  const handlePublish = async () => {
    if (!title || !price) {
      Alert.alert('Error', 'Please fill in title and price');
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement eBay listing creation via Firebase Cloud Function
      Alert.alert(
        'Success',
        'Listing created successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Dashboard'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.headerText}>Review Your Listing</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter item title"
            editable={!loading}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter item description"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            editable={!loading}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Price ($)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            keyboardType="decimal-pad"
            editable={!loading}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <Text style={styles.value}>
            {analysisData.analysis?.category || 'Unknown'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Condition</Text>
          <Text style={styles.value}>
            {analysisData.analysis?.condition?.rating || 'Unknown'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.publishButton, loading && styles.buttonDisabled]}
          onPress={handlePublish}
          disabled={loading}>
          <Text style={styles.publishButtonText}>
            {loading ? 'Publishing...' : 'Publish to eBay'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: '#666',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 120,
  },
  publishButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ListingPreviewScreen;
