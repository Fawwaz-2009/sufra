import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

/**
 * The photo path's source chooser (ADR 0019's entry redesign): ONE "Photo" affordance opens the native
 * action sheet — Take photo / Choose from library — so the library folds into the photo door instead of
 * being a sibling entry. iOS gets the real ActionSheetIOS; Android (dev-build only) falls back to Alert.
 * Returns the picked asset, or null on cancel / denied permission (the caller does nothing on null).
 */
export async function pickMealPhotoAsset(): Promise<ImagePicker.ImagePickerAsset | null> {
  const choice = await chooseSource();
  if (choice === 'cancel') return null;

  if (choice === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access required', 'Allow camera access to log a Meal from a photo.');
      return null;
    }
    return firstAsset(
      await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false })
    );
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photo access required', 'Allow photo access to choose a Meal photo.');
    return null;
  }
  return firstAsset(
    await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false })
  );
}

type SourceChoice = 'camera' | 'library' | 'cancel';

function chooseSource(): Promise<SourceChoice> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 },
        (index) => resolve(index === 0 ? 'camera' : index === 1 ? 'library' : 'cancel')
      );
      return;
    }
    Alert.alert(
      'Add a photo',
      undefined,
      [
        { text: 'Take photo', onPress: () => resolve('camera') },
        { text: 'Choose from library', onPress: () => resolve('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
      ],
      { cancelable: true, onDismiss: () => resolve('cancel') }
    );
  });
}

function firstAsset(result: ImagePicker.ImagePickerResult): ImagePicker.ImagePickerAsset | null {
  if (result.canceled) return null;
  return result.assets[0] ?? null;
}
