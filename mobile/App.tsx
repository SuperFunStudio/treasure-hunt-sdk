import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// Screens
import SignInScreen from './src/screens/SignInScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CameraScreen from './src/screens/CameraScreen';
import AnalysisResultScreen from './src/screens/AnalysisResultScreen';
import ListingPreviewScreen from './src/screens/ListingPreviewScreen';

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="SignIn"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#4CAF50',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}>
          <Stack.Screen
            name="SignIn"
            component={SignInScreen}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{title: 'Treasure Hunt'}}
          />
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{title: 'Capture Item'}}
          />
          <Stack.Screen
            name="AnalysisResult"
            component={AnalysisResultScreen}
            options={{title: 'Analysis Results'}}
          />
          <Stack.Screen
            name="ListingPreview"
            component={ListingPreviewScreen}
            options={{title: 'Create Listing'}}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
