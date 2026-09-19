import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { DemoGuide } from '../components/DemoGuide';
import { TopicPicker } from '../components/TopicPicker';
import { getTopic } from '../data/topics';
import { chooseChanceTopic, chooseUnchartedTopic } from '../lib/journey';
import { useJourney } from '../state/JourneyContext';

interface HomePageProps {
  demo?: boolean;
}

type PickerMode = 'interest' | 'uncharted' | null;

export function HomePage({ demo = false }: HomePageProps) {
  const navigate = useNavigate();
  const { state, activeJourney, startJourney, continueJourney, enterDemo } = useJourney();
  const [picker, setPicker] = useState<PickerMode>(null);
  const lastJourney = state.journeys.at(-1) ?? null;

  useEffect(() => {
    if (demo && !state.isDemo) enterDemo();
  }, [demo, state.isDemo, enterDemo]);

  const unknownAnchor = useMemo(
    () => lastJourney?.currentTopicId ?? null,
    [lastJourney],
  );

  function depart(topicId: string) {
    startJourney(topicId, demo || state.isDemo);
    setPicker(null);
    navigate('/world');
  }

  function chanceDepart() {
    depart(chooseChanceTopic(state.journeys).id);
  }

  function unchartedDepart(anchorTopicId: string) {
    depart(chooseUnchartedTopic(state.journeys, anchorTopicId).id);
  }

  function resume() {
    if (!lastJourney) return;
    continueJourney(lastJourney.id);
    navigate('/world');
  }

  return (
    <AppShell>
      <section className="hero">
        <div className="hero__sky" aria-hidden="true">
          <i className="star star--one" /><i className="star star--two" /><i className="star star--three" />
          <div className="distant-moon" />
          <div className="distant-tower"><span /></div>
          <div className="mountain mountain--back" />
          <div className="mountain mountain--front" />
          <div className="hero-fog" />
        </div>
        <div className="hero__content">
          <span className="eyebrow">YOUR INFORMATION ADVENTURE</span>
          <h1>今日は、<br /><em>どこへ行く？</em></h1>
          <p>知っている場所を出発点に、まだ名前も知らない世界へ。<br />答えではなく、次の疑問を見つける旅です。</p>
        </div>
        <div className="departure-grid" aria-label="出発方法">
          <button className={`departure-card ${demo || state.isDemo ? 'is-guided' : ''}`} onClick={() => setPicker('interest')}>
            <span className="departure-card__number">01</span>
            <span className="departure-card__icon" aria-hidden="true">⌖</span>
            <strong>興味から出発</strong>
            <small>知っているテーマを、冒険の入口に</small>
            <i>テーマを選ぶ →</i>
          </button>
          <button className="departure-card" onClick={chanceDepart}>
            <span className="departure-card__number">02</span>
            <span className="departure-card__icon" aria-hidden="true">◈</span>
            <strong>偶然に任せる</strong>
            <small>今いる場所の、意外な隣へ</small>
            <i>今日の入口へ →</i>
          </button>
          <button className="departure-card" onClick={() => unknownAnchor ? unchartedDepart(unknownAnchor) : setPicker('uncharted')}>
            <span className="departure-card__number">03</span>
            <span className="departure-card__icon" aria-hidden="true">✦</span>
            <strong>未知へ飛ぶ</strong>
            <small>興味から遠い大陸を目指す</small>
            <i>{unknownAnchor ? `${getTopic(unknownAnchor).name}の外へ` : '基準を選ぶ'} →</i>
          </button>
        </div>
        {lastJourney && !demo && !state.isDemo && (
          <button className="resume-card" onClick={resume}>
            <span><small>前回の冒険</small><strong>{getTopic(lastJourney.startTopicId).name} から {getTopic(lastJourney.currentTopicId).name} へ</strong></span>
            <span>続きを旅する <b>→</b></span>
          </button>
        )}
        {!demo && !state.isDemo && (
          <button className="demo-entry" onClick={() => navigate('/demo')}>5分のガイド付き冒険を体験する <span>↗</span></button>
        )}
      </section>

      {(demo || state.isDemo) && <DemoGuide screen="home" topicId={null} />}
      {picker === 'interest' && (
        <TopicPicker
          title="どの興味から出発する？"
          description="今よく知っている場所ほど、遠くへ伸びる道が見つかります。"
          forcedTopicId={demo || state.isDemo ? 'game' : undefined}
          onChoose={depart}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'uncharted' && (
        <TopicPicker
          title="あなたの現在地は？"
          description="よく知るテーマを一つ選ぶと、そこから最も遠い未踏領域へ案内します。"
          submitLabel="遠い世界を探す"
          onChoose={unchartedDepart}
          onClose={() => setPicker(null)}
        />
      )}
    </AppShell>
  );
}
