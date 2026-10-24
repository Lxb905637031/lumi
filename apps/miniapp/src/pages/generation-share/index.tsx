import { useRouter } from '@tarojs/taro';
import { GenerationSharePage } from '../../features/generations/components/GenerationSharePage';

export default function GenerationShareRoute() {
  const router = useRouter();
  return <GenerationSharePage token={router.params.token} />;
}
