import { Text, View } from '@tarojs/components';
import { useEffect, useState } from 'react';
import type { CommunityChallenge } from '@lumi/contracts';
import { AppButton } from '../../../components/ui/AppButton/AppButton';
import { InlineFeedback } from '../../../components/ui/InlineFeedback/InlineFeedback';
import { hasSession } from '../../../services/http-client';
import { getChallengeParticipation, listChallenges, setChallengeParticipation } from '../community.api';
import './ChallengeList.scss';

type ChallengeRow = CommunityChallenge & { active: boolean; joinedAt: string | null };

export function ChallengeList() {
  const [items, setItems] = useState<ChallengeRow[]>([]);
  const [error, setError] = useState('');
  const [busySlug, setBusySlug] = useState('');

  useEffect(() => {
    let active = true;
    void listChallenges()
      .then(async (challenges) => {
        const rows = await Promise.all(
          challenges.map(async (challenge) => {
            if (!hasSession()) return { ...challenge, active: false, joinedAt: null };
            const participation = await getChallengeParticipation(challenge.slug).catch(() => ({
              active: false,
              joinedAt: null,
            }));
            return { ...challenge, ...participation };
          }),
        );
        if (active) setItems(rows);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '挑战加载失败');
      });
    return () => {
      active = false;
    };
  }, []);

  async function toggle(item: ChallengeRow) {
    setBusySlug(item.slug);
    setError('');
    try {
      const state = await setChallengeParticipation(item.slug, !item.active);
      setItems((current) => current.map((row) => (row.slug === item.slug ? { ...row, ...state } : row)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败，请重试');
    } finally {
      setBusySlug('');
    }
  }

  if (!items.length && !error) return null;
  return (
    <View className="challenge-list">
      <View className="challenge-list__heading">
        <Text className="challenge-list__title">本期挑战</Text>
        <Text className="challenge-list__caption">参与后发布穿搭作品</Text>
      </View>
      {error && <InlineFeedback message={error} tone="error" />}
      {items.map((item) => (
        <View className="challenge-list__item" key={item.id}>
          <View className="challenge-list__copy">
            <Text className="challenge-list__name">{item.title}</Text>
            <Text className="challenge-list__description">{item.description}</Text>
            <Text className="challenge-list__meta">
              {item.participantCount} 人参与 · 截止 {new Date(item.endsAt).toLocaleDateString('zh-CN')}
            </Text>
          </View>
          <AppButton
            compact
            variant={item.active ? 'secondary' : 'primary'}
            loading={busySlug === item.slug}
            onClick={() => void toggle(item)}
          >
            {item.active ? '已参加' : '参加'}
          </AppButton>
        </View>
      ))}
    </View>
  );
}
