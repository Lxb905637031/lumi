import { Text, View } from '@tarojs/components';
import './InlineFeedback.scss';

type InlineFeedbackProps = {
  message: string;
  tone?: 'info' | 'success' | 'error';
};

export function InlineFeedback({ message, tone = 'info' }: InlineFeedbackProps) {
  return (
    <View className={`inline-feedback inline-feedback--${tone}`} role="status">
      <Text>{message}</Text>
    </View>
  );
}
