import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  BackHandler,
  Dimensions,
  DeviceEventEmitter,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  onExit: () => void;
  onUnregister: () => void;
}

type MenuOption = 'resume' | 'exit' | 'unregister';

export function MenuModal({ visible, onClose, onExit, onUnregister }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmIndex, setConfirmIndex] = useState(0);
  const ignoreFirstSelect = useRef(true);

  const menuOptions: { key: MenuOption; label: string }[] = [
    { key: 'resume', label: 'Resume' },
    { key: 'exit', label: 'Exit' },
    { key: 'unregister', label: 'Unregister Display' },
  ];

  const confirmOptions = ['Cancel', 'Unregister'];

  const handleSelect = useCallback((option: MenuOption) => {
    console.log('Menu selected:', option);
    switch (option) {
      case 'resume':
        onClose();
        break;
      case 'exit':
        onExit();
        break;
      case 'unregister':
        setShowConfirm(true);
        setConfirmIndex(0);
        break;
    }
  }, [onClose, onExit]);

  const handleConfirmSelect = useCallback((index: number) => {
    console.log('Confirm selected:', index);
    if (index === 1) {
      onUnregister();
    } else {
      setShowConfirm(false);
    }
  }, [onUnregister]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setShowConfirm(false);
      setSelectedIndex(0);
      setConfirmIndex(0);
      ignoreFirstSelect.current = true;
      // Allow select after a short delay
      setTimeout(() => {
        ignoreFirstSelect.current = false;
      }, 300);
    }
  }, [visible]);

  // Listen for native key events
  useEffect(() => {
    if (!visible) return;

    const subscription = DeviceEventEmitter.addListener('onKeyDown', (eventName: string) => {
      console.log('MenuModal received key:', eventName);

      if (!showConfirm) {
        // Main menu navigation
        switch (eventName) {
          case 'up':
            setSelectedIndex(prev => Math.max(0, prev - 1));
            break;
          case 'down':
            setSelectedIndex(prev => Math.min(menuOptions.length - 1, prev + 1));
            break;
          case 'select':
            if (ignoreFirstSelect.current) {
              console.log('Ignoring first select');
              return;
            }
            handleSelect(menuOptions[selectedIndex].key);
            break;
          case 'back':
            onClose();
            break;
        }
      } else {
        // Confirm dialog navigation (horizontal)
        switch (eventName) {
          case 'left':
            setConfirmIndex(0);
            break;
          case 'right':
            setConfirmIndex(1);
            break;
          case 'select':
            handleConfirmSelect(confirmIndex);
            break;
          case 'back':
            setShowConfirm(false);
            break;
        }
      }
    });

    return () => subscription.remove();
  }, [visible, showConfirm, selectedIndex, confirmIndex, menuOptions, handleSelect, handleConfirmSelect, onClose]);

  // Back button handler
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showConfirm) {
        setShowConfirm(false);
        return true;
      }
      onClose();
      return true;
    });

    return () => backHandler.remove();
  }, [visible, showConfirm, onClose]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.menuContainer}>
        {!showConfirm ? (
          <>
            <Text style={styles.title}>Menu</Text>
            {menuOptions.map((option, index) => {
              const isSelected = index === selectedIndex;
              return (
                <View
                  key={option.key}
                  style={[
                    styles.menuItem,
                    isSelected && styles.menuItemFocused,
                  ]}
                >
                  <Text style={[
                    styles.menuItemText,
                    isSelected && styles.menuItemTextFocused,
                  ]}>
                    {isSelected ? '► ' : '   '}{option.label}
                  </Text>
                </View>
              );
            })}
          </>
        ) : (
          <>
            <Text style={styles.title}>Confirm Unregister</Text>
            <Text style={styles.confirmText}>
              This will remove this display from your church account.
              You will need to pair it again to use it.
            </Text>
            <View style={styles.confirmButtons}>
              {confirmOptions.map((label, index) => {
                const isSelected = index === confirmIndex;
                return (
                  <View
                    key={label}
                    style={[
                      styles.confirmButton,
                      index === 1 && styles.confirmButtonDanger,
                      isSelected && styles.confirmButtonFocused,
                    ]}
                  >
                    <Text style={[
                      styles.confirmButtonText,
                      isSelected && styles.confirmButtonTextFocused,
                    ]}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  menuContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 32,
    minWidth: 400,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  menuItem: {
    backgroundColor: '#333',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginVertical: 6,
    borderWidth: 3,
    borderColor: '#333',
  },
  menuItemFocused: {
    backgroundColor: '#0066cc',
    borderColor: '#00aaff',
  },
  menuItemPressed: {
    backgroundColor: '#004499',
  },
  menuItemText: {
    fontSize: 24,
    color: '#aaa',
    textAlign: 'left',
  },
  menuItemTextFocused: {
    color: '#fff',
    fontWeight: 'bold',
  },
  confirmText: {
    fontSize: 18,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  confirmButton: {
    backgroundColor: '#333',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#333',
  },
  confirmButtonDanger: {
    backgroundColor: '#661111',
    borderColor: '#661111',
  },
  confirmButtonFocused: {
    backgroundColor: '#0066cc',
    borderColor: '#00aaff',
  },
  confirmButtonPressed: {
    backgroundColor: '#004499',
  },
  confirmButtonText: {
    fontSize: 20,
    color: '#aaa',
    textAlign: 'center',
  },
  confirmButtonTextFocused: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
