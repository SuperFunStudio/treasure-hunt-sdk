import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';

class FirebaseService {
  // Authentication
  async signInWithEmail(email: string, password: string) {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  async signUpWithEmail(email: string, password: string) {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      await auth().signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  getCurrentUser() {
    return auth().currentUser;
  }

  async getAuthToken() {
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return await user.getIdToken();
  }

  // Firestore
  async getUserProfile(userId: string) {
    try {
      const doc = await firestore().collection('users').doc(userId).get();
      return doc.exists ? doc.data() : null;
    } catch (error) {
      console.error('Get user profile error:', error);
      throw error;
    }
  }

  async updateUserProfile(userId: string, data: any) {
    try {
      await firestore().collection('users').doc(userId).set(data, {merge: true});
    } catch (error) {
      console.error('Update user profile error:', error);
      throw error;
    }
  }

  // Storage
  async uploadImage(uri: string, path: string, onProgress?: (progress: number) => void) {
    try {
      const reference = storage().ref(path);
      const task = reference.putFile(uri);

      if (onProgress) {
        task.on('state_changed', snapshot => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        });
      }

      await task;
      const downloadUrl = await reference.getDownloadURL();
      return downloadUrl;
    } catch (error) {
      console.error('Upload image error:', error);
      throw error;
    }
  }

  // Cloud Functions
  async callFunction(functionName: string, data: any) {
    try {
      const callable = functions().httpsCallable(functionName);
      const result = await callable(data);
      return result.data;
    } catch (error) {
      console.error(`Call function ${functionName} error:`, error);
      throw error;
    }
  }
}

export default new FirebaseService();
