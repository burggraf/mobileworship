import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DisplaysListScreen } from '../screens/displays/DisplaysListScreen';
import { AddDisplayScreen } from '../screens/displays/AddDisplayScreen';
import { NameDisplayScreen } from '../screens/displays/NameDisplayScreen';
import { DisplayDetailScreen } from '../screens/displays/DisplayDetailScreen';

export type DisplaysStackParamList = {
  DisplaysList: undefined;
  AddDisplay: undefined;
  NameDisplay: { code: string };
  DisplayDetail: { displayId: string };
};

const Stack = createNativeStackNavigator<DisplaysStackParamList>();

export function DisplaysNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DisplaysList"
        component={DisplaysListScreen}
        options={{ title: 'Displays' }}
      />
      <Stack.Screen
        name="AddDisplay"
        component={AddDisplayScreen}
        options={{ title: 'Add Display' }}
      />
      <Stack.Screen
        name="NameDisplay"
        component={NameDisplayScreen}
        options={{ title: 'Name Display' }}
      />
      <Stack.Screen
        name="DisplayDetail"
        component={DisplayDetailScreen}
        options={{ title: 'Display' }}
      />
    </Stack.Navigator>
  );
}
