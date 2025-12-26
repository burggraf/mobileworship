// apps/client/src/screens/displays/DisplayDetailScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useDisplay, useDisplays } from '@mobileworship/shared';
import type { FontSize, TextPosition, FontFamily } from '@mobileworship/shared';
import type { DisplaysStackParamList } from '../../navigation/DisplaysNavigator';

type NavigationProp = NativeStackNavigationProp<DisplaysStackParamList>;
type RouteType = RouteProp<DisplaysStackParamList, 'DisplayDetail'>;

const FONT_SIZES: FontSize[] = ['small', 'medium', 'large', 'xlarge'];
const TEXT_POSITIONS: TextPosition[] = ['center', 'bottom', 'lower-third'];
const FONT_FAMILIES: FontFamily[] = ['system', 'serif', 'sans-serif'];

function SettingRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700"
      onPress={onPress}
    >
      <Text className="text-gray-900 dark:text-white">{label}</Text>
      <View className="flex-row items-center">
        <Text className="text-gray-500 dark:text-gray-400 mr-2 capitalize">
          {value}
        </Text>
        <Text className="text-gray-400">›</Text>
      </View>
    </TouchableOpacity>
  );
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Never';
  const date = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleDateString();
}

export function DisplayDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { displayId } = route.params;
  const { display, isLoading, updateSettings, updateName, remove, testConnection } =
    useDisplay(displayId);
  const { checkDisplayOnline } = useDisplays();

  const [isTesting, setIsTesting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [showPicker, setShowPicker] = useState<{
    type: 'fontSize' | 'textPosition' | 'fontFamily';
    current: string;
  } | null>(null);

  if (isLoading || !display) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const online = checkDisplayOnline(display.id, display.lastSeenAt);

  const handleTestConnection = async () => {
    setIsTesting(true);
    const connected = await testConnection();
    setIsTesting(false);
    Alert.alert(
      connected ? 'Connected!' : 'Not Responding',
      connected
        ? 'The display is online and responding.'
        : 'The display did not respond. Make sure it is powered on and connected to the internet.'
    );
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove Display',
      `Are you sure you want to remove "${display.name}"? The display will need to be paired again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await remove.mutateAsync();
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleEditSave = async () => {
    if (!editName.trim()) return;
    await updateName.mutateAsync({
      name: editName.trim(),
      location: editLocation.trim() || undefined,
    });
    setShowEditModal(false);
  };

  const openEditModal = () => {
    setEditName(display.name);
    setEditLocation(display.location || '');
    setShowEditModal(true);
  };

  const handlePickerSelect = async (value: string) => {
    if (!showPicker) return;
    await updateSettings.mutateAsync({
      [showPicker.type]: value,
    });
    setShowPicker(null);
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: display.name,
      headerRight: () => (
        <TouchableOpacity onPress={openEditModal} className="mr-4">
          <Text className="text-blue-500 font-medium">Edit</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, display.name]);

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900">
      {/* Status Section */}
      <View className="p-4 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center mb-2">
          <Text className="text-gray-500 dark:text-gray-400 w-24">Status</Text>
          <View className="flex-row items-center">
            <View
              className={`w-3 h-3 rounded-full mr-2 ${
                online ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <Text className="text-gray-900 dark:text-white">
              {online ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
        {display.deviceInfo && (
          <View className="flex-row items-center mb-2">
            <Text className="text-gray-500 dark:text-gray-400 w-24">Device</Text>
            <Text className="text-gray-900 dark:text-white capitalize">
              {display.deviceInfo.platform} • {display.deviceInfo.resolution.width}×
              {display.deviceInfo.resolution.height}
            </Text>
          </View>
        )}
        <View className="flex-row items-center">
          <Text className="text-gray-500 dark:text-gray-400 w-24">Last seen</Text>
          <Text className="text-gray-900 dark:text-white">
            {formatLastSeen(display.lastSeenAt)}
          </Text>
        </View>
      </View>

      {/* Display Settings */}
      <View className="p-4">
        <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase">
          Display Settings
        </Text>

        <SettingRow
          label="Font Size"
          value={display.settings.fontSize}
          onPress={() =>
            setShowPicker({ type: 'fontSize', current: display.settings.fontSize })
          }
        />
        <SettingRow
          label="Text Position"
          value={display.settings.textPosition.replace('-', ' ')}
          onPress={() =>
            setShowPicker({ type: 'textPosition', current: display.settings.textPosition })
          }
        />
        <SettingRow
          label="Font Family"
          value={display.settings.fontFamily}
          onPress={() =>
            setShowPicker({ type: 'fontFamily', current: display.settings.fontFamily })
          }
        />

        <View className="flex-row items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
          <Text className="text-gray-900 dark:text-white">Text Shadow</Text>
          <Switch
            value={display.settings.textShadow}
            onValueChange={(value) => updateSettings.mutate({ textShadow: value })}
          />
        </View>
      </View>

      {/* Actions */}
      <View className="p-4 gap-3">
        <TouchableOpacity
          className="bg-blue-500 py-4 rounded-lg items-center"
          onPress={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold">Test Connection</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="py-4 rounded-lg items-center"
          onPress={handleRemove}
        >
          <Text className="text-red-500 font-semibold">Remove Display</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-xl p-6">
            <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Edit Display
            </Text>

            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 mb-4 text-gray-900 dark:text-white"
              value={editName}
              onChangeText={setEditName}
            />

            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 mb-6 text-gray-900 dark:text-white"
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="Optional"
              placeholderTextColor="#9CA3AF"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-4 rounded-lg bg-gray-200 dark:bg-gray-700"
                onPress={() => setShowEditModal(false)}
              >
                <Text className="text-center font-semibold text-gray-900 dark:text-white">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-4 rounded-lg bg-blue-500"
                onPress={handleEditSave}
              >
                <Text className="text-center font-semibold text-white">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Picker Modal */}
      <Modal visible={!!showPicker} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-xl p-6">
            <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-4 capitalize">
              {showPicker?.type.replace(/([A-Z])/g, ' $1').trim()}
            </Text>

            {(showPicker?.type === 'fontSize'
              ? FONT_SIZES
              : showPicker?.type === 'textPosition'
              ? TEXT_POSITIONS
              : FONT_FAMILIES
            ).map((option) => (
              <TouchableOpacity
                key={option}
                className="py-4 border-b border-gray-200 dark:border-gray-700"
                onPress={() => handlePickerSelect(option)}
              >
                <Text
                  className={`capitalize ${
                    option === showPicker?.current
                      ? 'text-blue-500 font-semibold'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {option.replace('-', ' ')}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              className="mt-4 py-4 rounded-lg bg-gray-200 dark:bg-gray-700"
              onPress={() => setShowPicker(null)}
            >
              <Text className="text-center font-semibold text-gray-900 dark:text-white">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
