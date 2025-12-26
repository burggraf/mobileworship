import 'react-native-url-polyfill/auto';
import { AppRegistry, LogBox } from 'react-native';
import App from './App';

// Suppress Supabase Realtime deprecation warning
LogBox.ignoreLogs(['Realtime send() is automatically falling back']);

AppRegistry.registerComponent('MobileWorshipHost', () => App);
