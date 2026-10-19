import { Input, Textarea } from '@tarojs/components';
import type { PostDraft } from '../post-composer-workflow';

type Fields = Pick<PostDraft, 'title' | 'body' | 'topic'>;
export function PostComposerFields({
  draft,
  disabled,
  onChange,
}: {
  draft: Fields;
  disabled: boolean;
  onChange: (patch: Partial<Fields>) => void;
}) {
  return (
    <>
      <Input
        className="feed-input"
        value={draft.title}
        disabled={disabled}
        onInput={(event) => onChange({ title: event.detail.value })}
        placeholder="标题（必填）"
        maxlength={120}
      />
      <Textarea
        className="feed-textarea"
        value={draft.body}
        disabled={disabled}
        onInput={(event) => onChange({ body: event.detail.value })}
        placeholder="分享你的穿搭想法（必填）"
        maxlength={5000}
      />
      <Input
        className="feed-input"
        value={draft.topic}
        disabled={disabled}
        onInput={(event) => onChange({ topic: event.detail.value })}
        placeholder="话题（可选）"
        maxlength={80}
      />
    </>
  );
}
