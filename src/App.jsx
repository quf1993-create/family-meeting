import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Users,
  Calendar,
  MapPin,
  CheckCircle2,
  Share2,
  Plus,
  ExternalLink,
  ThumbsUp,
  ArrowLeft,
  UserCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';

// ==========================================
// 1. 내 환경 설정값 (반영 완료)
// ==========================================
const SUPABASE_URL = 'https://hkguidilotltuyqdhryl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PQGaxgpqp90K7DCS_H4h4g_mA1IR1bH';
const TRAVEL_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7zk54HDD8ijkuOVOPlfQ8zU_sHVIIk_SJ9JL1qrDQhLeuWNDxC3a366CZVyd0WQvxrQMV0WfHuS2k/pub?gid=1005138885&single=true&output=csv';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. 가족 명단 & 그룹 지정 (XXX 실명, group_name 수정 가능)
// ==========================================
const FALLBACK_MEMBERS = [
  { id: 'm1', name: '아빠(김광식)', role: 'senior', group_name: '본가', is_admin: false },
  { id: 'm2', name: '엄마(강선심)', role: 'senior', group_name: '본가', is_admin: false },
  { id: 'm3', name: '첫째 딸(김래영)', role: 'adult', group_name: '첫째네', is_admin: false },
  { id: 'm4', name: '첫째 사위(박기원)', role: 'adult', group_name: '첫째네', is_admin: false },
  { id: 'm5', name: '둘째 딸(김민영)', role: 'adult', group_name: '둘째네', is_admin: false },
  { id: 'm6', name: '둘째 사위(편영범)', role: 'adult', group_name: '둘째네', is_admin: true },
  { id: 'm7', name: '막내 딸(김다영)', role: 'teen', group_name: '본가', is_admin: false },
  { id: 'm8', name: '귀염둥이(박하루)', role: 'toddler', group_name: '첫째네', is_admin: false },
];

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const NIGHT_OPTIONS = [1, 2, 3, 4, 5, 6];

const MONTH_DAYS = {
  '1월': 31,
  '2월': 28,
  '3월': 31,
  '4월': 30,
  '5월': 31,
  '6월': 30,
  '7월': 31,
  '8월': 31,
  '9월': 30,
  '10월': 31,
  '11월': 30,
  '12월': 31,
};

const MONTH_COMFORT_SCORE = {
  '5월': 95,
  '10월': 94,
  '4월': 90,
  '9월': 88,
  '6월': 84,
  '11월': 83,
  '3월': 80,
  '2월': 76,
  '12월': 74,
  '1월': 70,
  '7월': 65,
  '8월': 62,
};

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDestinationsCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
  return lines.slice(1).map((line, idx) => {
    const cols = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] || '';
    });
    return {
      id: row.id || `dest-${idx + 1}`,
      title: row.title || row['여행지명'] || row['도시/지역'] || `추천 여행지 ${idx + 1}`,
      region: row.region || row['지역'] || row['권역'] || '',
      recommended_months: row.recommended_months || row['추천월'] || row['추천시기'] || '전월',
      recommended_nights:
        Number(row.recommended_nights || row['추천박수'] || row['권장박수'] || 3) || 3,
      estimated_total_cost:
        row.estimated_total_cost || row['예상비용'] || row['8인예상총액'] || '문의 필요',
      travel_time: row.travel_time || row['이동시간'] || row['비행시간'] || '',
      accommodation_type: row.accommodation_type || row['숙소형태'] || row['추천숙소'] || '',
      highlights:
        row.highlights || row['대표명소'] || row['추천포인트'] || row['전연령포인트'] || '',
      link_url: row.link_url || row['참고링크'] || '',
    };
  });
}

export default function App() {
  const [pinInput, setPinInput] = useState('');
  const [familyPin, setFamilyPin] = useState('1234');
  const [appTitle, setAppTitle] = useState('우리 가족 회의실');
  const [isUnlocked, setIsUnlocked] = useState(false);

  const [members, setMembers] = useState(FALLBACK_MEMBERS);
  const [loggedInMemberId, setLoggedInMemberId] = useState('m6');
  const [actingAsMemberId, setActingAsMemberId] = useState('m6');

  const [screen, setScreen] = useState('home');
  const [topics, setTopics] = useState([]);
  const [activeTopic, setActiveTopic] = useState(null);
  const [scheduleVotes, setScheduleVotes] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [candidateVotes, setCandidateVotes] = useState([]);
  const [destinations, setDestinations] = useState([]);

  const [myMonths, setMyMonths] = useState([]);
  const [myMaxNights, setMyMaxNights] = useState(3);
  const [myMemo, setMyMemo] = useState('');

  const [runoffChoice, setRunoffChoice] = useState('');
  const [selectedTargetMonth, setSelectedTargetMonth] = useState('2월');
  const [mySelectedDates, setMySelectedDates] = useState([]);

  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newCand, setNewCand] = useState({
    title: '',
    estimated_total_cost: '',
    travel_time: '',
    accommodation_type: '',
    highlights: '',
    link_url: '',
  });
  const [statusMsg, setStatusMsg] = useState('');

  const showToast = (msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  useEffect(() => {
    async function loadInitial() {
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (settingsData) {
        if (settingsData.app_title) setAppTitle(settingsData.app_title);
        if (settingsData.family_pin) setFamilyPin(settingsData.family_pin);
      }

      const { data: membersData } = await supabase.from('members').select('*').order('id');
      if (membersData && membersData.length > 0) {
        setMembers(membersData);
      }

      const { data: topicsData } = await supabase
        .from('topics')
        .select('*')
        .order('created_at', { ascending: false });
      if (topicsData) {
        setTopics(topicsData);
        if (topicsData.length > 0) setActiveTopic(topicsData[0]);
      }

      try {
        const res = await fetch(TRAVEL_CSV_URL);
        const text = await res.text();
        setDestinations(parseDestinationsCsv(text));
      } catch (e) {
        console.error('CSV load error:', e);
      }
    }
    loadInitial();
  }, []);

  useEffect(() => {
    async function loadTopicDetails() {
      if (!activeTopic) return;
      const { data: sVotes } = await supabase
        .from('schedule_votes')
        .select('*')
        .eq('topic_id', activeTopic.id);
      setScheduleVotes(sVotes || []);

      const { data: cands } = await supabase
        .from('candidates')
        .select('*')
        .eq('topic_id', activeTopic.id)
        .order('id');
      setCandidates(cands || []);

      const { data: cVotes } = await supabase
        .from('candidate_votes')
        .select('*')
        .eq('topic_id', activeTopic.id);
      setCandidateVotes(cVotes || []);
    }
    loadTopicDetails();
  }, [activeTopic]);

  useEffect(() => {
    const existing = scheduleVotes.find((v) => v.member_id === actingAsMemberId);
    if (existing) {
      setMyMonths(Array.isArray(existing.available_months) ? existing.available_months : []);
      setMyMaxNights(existing.max_nights || 3);
      setMyMemo(existing.memo || '');
      const savedDates = Array.isArray(existing.selected_dates) ? existing.selected_dates : [];
      setMySelectedDates(savedDates);
    } else {
      setMyMonths([]);
      setMyMaxNights(3);
      setMyMemo('');
      setMySelectedDates([]);
    }
  }, [actingAsMemberId, scheduleVotes]);

  const loggedInMember = useMemo(
    () => members.find((m) => m.id === loggedInMemberId) || members[0],
    [members, loggedInMemberId]
  );

  const sortedMembersForProxy = useMemo(() => {
    if (!loggedInMember) return members;
    const sameGroup = members.filter((m) => m.group_name === loggedInMember.group_name);
    const others = members.filter((m) => m.group_name !== loggedInMember.group_name);
    return [...sameGroup, ...others];
  }, [members, loggedInMember]);

  const scheduleSummary = useMemo(() => {
    const monthCounts = {};
    MONTHS.forEach((m) => (monthCounts[m] = 0));

    scheduleVotes.forEach((v) => {
      if (Array.isArray(v.available_months)) {
        v.available_months.forEach((m) => {
          if (monthCounts[m] !== undefined) monthCounts[m] += 1;
        });
      }
    });

    const totalVotes = scheduleVotes.length;
    const unanimousMonths =
      totalVotes === members.length && members.length > 0
        ? MONTHS.filter((m) => monthCounts[m] === members.length).sort(
            (a, b) => (MONTH_COMFORT_SCORE[b] || 0) - (MONTH_COMFORT_SCORE[a] || 0)
          )
        : [];

    const maxCount = Math.max(0, ...Object.values(monthCounts));
    const topMonths =
      unanimousMonths.length > 0
        ? unanimousMonths
        : maxCount > 0
          ? MONTHS.filter((m) => monthCounts[m] === maxCount)
          : [];

    const nightsList = scheduleVotes
      .map((v) => Number(v.max_nights))
      .filter((n) => !Number.isNaN(n) && n > 0);
    const minAgreedNights = nightsList.length > 0 ? Math.min(...nightsList) : 3;

    const filterMonths = runoffChoice ? [runoffChoice] : topMonths;

    const matchedDestinations = destinations.filter((d) => {
      const monthOk =
        filterMonths.length === 0 ||
        !d.recommended_months ||
        d.recommended_months.includes('전월') ||
        filterMonths.some((m) => d.recommended_months.includes(m));
      const nightsOk = !d.recommended_nights || d.recommended_nights <= minAgreedNights + 1;
      return monthOk && nightsOk;
    });

    const dateCounts = {};
    scheduleVotes.forEach((v) => {
      if (Array.isArray(v.selected_dates)) {
        v.selected_dates.forEach((dt) => {
          dateCounts[dt] = (dateCounts[dt] || 0) + 1;
        });
      }
    });

    return {
      monthCounts,
      unanimousMonths,
      topMonths,
      maxCount,
      minAgreedNights,
      matchedDestinations:
        matchedDestinations.length > 0 ? matchedDestinations : destinations.slice(0, 6),
      dateCounts,
    };
  }, [scheduleVotes, members, destinations, runoffChoice]);

  useEffect(() => {
    if (runoffChoice) {
      setSelectedTargetMonth(runoffChoice);
    } else if (scheduleSummary.topMonths.length > 0) {
      setSelectedTargetMonth(scheduleSummary.topMonths[0]);
    }
  }, [runoffChoice, scheduleSummary.topMonths]);

  const handleSelectMemberAndEnter = (memberId) => {
    if (pinInput !== familyPin) {
      showToast('가족 비밀번호를 먼저 입력해 주세요. (기본값: 1234)');
      return;
    }
    setLoggedInMemberId(memberId);
    setActingAsMemberId(memberId);
    setIsUnlocked(true);
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (!newTopicTitle.trim()) return;
    const { data, error } = await supabase
      .from('topics')
      .insert({
        title: newTopicTitle.trim(),
        category: '여행',
        topic_type: 'schedule_step1',
        status: 'open',
      })
      .select()
      .single();
    if (!error && data) {
      setTopics((prev) => [data, ...prev]);
      setActiveTopic(data);
      setNewTopicTitle('');
      showToast('새 안건이 등록되었습니다!');
    } else {
      showToast('안건 저장 중 오류가 발생했습니다. Supabase 연결을 확인해 주세요.');
    }
  };

  const toggleMonth = (m) => {
    setMyMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const toggleDate = (dayNum) => {
    const label = `${selectedTargetMonth}-${dayNum}일`;
    setMySelectedDates((prev) =>
      prev.includes(label) ? prev.filter((d) => d !== label) : [...prev, label]
    );
  };

  const handleSaveScheduleVote = async () => {
    if (!activeTopic) {
      showToast('먼저 홈 화면에서 안건을 선택하거나 새로 만들어 주세요.');
      return;
    }
    const payload = {
      topic_id: activeTopic.id,
      member_id: actingAsMemberId,
      voted_by: loggedInMemberId,
      available_months: myMonths,
      max_nights: myMaxNights,
      selected_dates: mySelectedDates,
      memo: myMemo,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('schedule_votes')
      .upsert(payload, { onConflict: 'topic_id,member_id' })
      .select()
      .single();
    if (!error && data) {
      setScheduleVotes((prev) => {
        const filtered = prev.filter((v) => v.member_id !== actingAsMemberId);
        return [...filtered, data];
      });
      const targetName = members.find((m) => m.id === actingAsMemberId)?.name || '가족';
      showToast(`${targetName} 일정 및 날짜 투표가 저장되었습니다!`);
    } else {
      showToast('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    if (!newCand.title.trim() || !activeTopic) return;
    const { data, error } = await supabase
      .from('candidates')
      .insert({
        topic_id: activeTopic.id,
        title: newCand.title.trim(),
        estimated_total_cost: newCand.estimated_total_cost.trim(),
        travel_time: newCand.travel_time.trim(),
        accommodation_type: newCand.accommodation_type.trim(),
        highlights: newCand.highlights.trim(),
        link_url: newCand.link_url.trim(),
        created_by: loggedInMemberId,
      })
      .select()
      .single();
    if (!error && data) {
      setCandidates((prev) => [...prev, data]);
      setNewCand({
        title: '',
        estimated_total_cost: '',
        travel_time: '',
        accommodation_type: '',
        highlights: '',
        link_url: '',
      });
      showToast('후보 카드가 추가되었습니다!');
    }
  };

  const handlePromoteDestination = async (dest) => {
    if (!activeTopic) return;
    const { data, error } = await supabase
      .from('candidates')
      .insert({
        topic_id: activeTopic.id,
        title: dest.title,
        estimated_total_cost: dest.estimated_total_cost,
        travel_time: dest.travel_time,
        accommodation_type: dest.accommodation_type,
        highlights: dest.highlights,
        link_url: dest.link_url,
        created_by: loggedInMemberId,
      })
      .select()
      .single();
    if (!error && data) {
      setCandidates((prev) => [...prev, data]);
      showToast(`"${dest.title}" 후보로 추가되었습니다!`);
      setScreen('candidates');
    }
  };

  const handleToggleCandidateVote = async (candidateId) => {
    if (!activeTopic) return;
    const existing = candidateVotes.find(
      (v) => v.candidate_id === candidateId && v.member_id === actingAsMemberId
    );
    if (existing) {
      await supabase.from('candidate_votes').delete().eq('id', existing.id);
      setCandidateVotes((prev) => prev.filter((v) => v.id !== existing.id));
    } else {
      const { data } = await supabase
        .from('candidate_votes')
        .insert({
          topic_id: activeTopic.id,
          candidate_id: candidateId,
          member_id: actingAsMemberId,
          voted_by: loggedInMemberId,
        })
        .select()
        .single();
      if (data) setCandidateVotes((prev) => [...prev, data]);
    }
  };

  const shareSummaryText = useMemo(() => {
    const finalMonthText =
      runoffChoice ||
      (scheduleSummary.topMonths.length > 0 ? scheduleSummary.topMonths.join(', ') : '투표 진행중');

    const topDates = Object.entries(scheduleSummary.dateCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([dt, cnt]) => `${dt}(${cnt}명)`);

    const sortedCands = [...candidates].sort((a, b) => {
      const aCount = candidateVotes.filter((v) => v.candidate_id === a.id).length;
      const bCount = candidateVotes.filter((v) => v.candidate_id === b.id).length;
      return bCount - aCount;
    });
    const candLines =
      sortedCands.length > 0
        ? sortedCands
            .map((c, idx) => {
              const cnt = candidateVotes.filter((v) => v.candidate_id === c.id).length;
              return `${idx + 1}. ${c.title} (${cnt}표) - ${c.estimated_total_cost || '비용 미정'}`;
            })
            .join('\n')
        : '아직 등록된 후보가 없습니다.';

    return `[${appTitle}] ${activeTopic?.title || '2027 가족여행'} 현황
• 참여 인원: ${scheduleVotes.length}/${members.length}명
• 주요 가능 월: ${finalMonthText} (최대 ${scheduleSummary.minAgreedNights}박 기준)
• 인기 날짜: ${topDates.length > 0 ? topDates.join(', ') : '날짜 투표 진행중'}

[후보 투표 현황]
${candLines}`;
  }, [
    appTitle,
    activeTopic,
    scheduleVotes,
    members,
    scheduleSummary,
    runoffChoice,
    candidates,
    candidateVotes,
  ]);

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareSummaryText);
      showToast('카카오톡 공유용 요약이 복사되었습니다!');
    } catch {
      showToast('아래 요약 박스를 길게 눌러 복사해 주세요.');
    }
  };

  // ==========================================
  // 1. 입장 화면
  // ==========================================
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-md p-6 border border-amber-100 space-y-5">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 mb-1">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800">{appTitle}</h1>
            <p className="text-sm text-stone-500">비밀번호 입력 후 본인 이름을 터치해 입장하세요</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">
              가족 비밀번호 (기본: 1234)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="비밀번호 4자리 입력"
              className="w-full px-4 py-3 rounded-2xl border border-stone-300 text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              본인 이름 터치해서 입장
            </label>
            <div className="grid grid-cols-2 gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMemberAndEnter(m.id)}
                  className="flex items-center justify-between px-3.5 py-3 rounded-2xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50/60 bg-white text-stone-800 text-left font-semibold text-sm transition"
                >
                  <span className="truncate">{m.name}</span>
                  {m.is_admin && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 shrink-0 ml-1">
                      관리
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {statusMsg && <p className="text-sm text-center text-rose-600 font-medium">{statusMsg}</p>}
        </div>
      </div>
    );
  }

  const currentActor = members.find((m) => m.id === actingAsMemberId) || members[0];
  const votedMemberIds = new Set(scheduleVotes.map((v) => v.member_id));
  const missingMembers = members.filter((m) => !votedMemberIds.has(m.id));
  const daysInMonth = MONTH_DAYS[selectedTargetMonth] || 30;

  // ==========================================
  // 2. 메인 앱 화면
  // ==========================================
  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 pb-12">
      <header className="sticky top-0 z-20 bg-white border-b border-stone-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {screen !== 'home' && (
              <button
                type="button"
                onClick={() => setScreen('home')}
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="font-bold text-lg leading-tight">{appTitle}</h1>
              <p className="text-xs text-stone-500">
                접속: {loggedInMember?.name} · 그룹: {loggedInMember?.group_name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setScreen('share')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 text-amber-900 text-xs font-bold"
          >
            <Share2 className="w-4 h-4" />
            공유 요약
          </button>
        </div>

        <div className="max-w-2xl mx-auto mt-2.5 pt-2.5 border-t border-stone-100 flex items-center gap-2 overflow-x-auto">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 shrink-0">
            <UserCheck className="w-3.5 h-3.5 text-amber-600" />
            현재 투표 대상:
          </span>
          <select
            value={actingAsMemberId}
            onChange={(e) => setActingAsMemberId(e.target.value)}
            className="text-xs font-bold bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-2.5 py-1.5"
          >
            {sortedMembersForProxy.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.group_name})
              </option>
            ))}
          </select>
          <span className="text-[11px] text-stone-400 truncate">같은 그룹 가족 우선 표시</span>
        </div>
      </header>

      {statusMsg && (
        <div className="max-w-2xl mx-auto mt-3 px-4">
          <div className="p-3 rounded-2xl bg-stone-800 text-white text-sm font-medium text-center shadow">
            {statusMsg}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {screen === 'home' && (
          <>
            <form
              onSubmit={handleCreateTopic}
              className="bg-white rounded-3xl p-4 border border-stone-200 flex gap-2"
            >
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="예: 2027 가족 해외여행 일정 & 여행지 정하기"
                className="flex-1 px-3.5 py-2.5 rounded-2xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shrink-0"
              >
                <Plus className="w-4 h-4" />
                새 안건
              </button>
            </form>

            {topics.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 border border-stone-200 text-center text-stone-500 text-sm">
                아직 등록된 안건이 없습니다. 위 입력창에 첫 안건을 만들어 보세요!
              </div>
            ) : (
              topics.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-3xl p-5 border border-stone-200 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                        {t.category || '여행'}
                      </span>
                      <h2 className="text-lg font-bold text-stone-800 mt-1.5">{t.title}</h2>
                    </div>
                    <span className="text-xs font-semibold text-stone-500">
                      참여 {scheduleVotes.length}/{members.length}명
                    </span>
                  </div>

                  <p className="text-xs text-stone-500">
                    미참여:{' '}
                    {missingMembers.length > 0
                      ? missingMembers.map((m) => m.name).join(', ')
                      : '전원 참여 완료!'}
                  </p>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTopic(t);
                        setScreen('schedule');
                      }}
                      className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold"
                    >
                      <Calendar className="w-4 h-4" />
                      일정·날짜 투표
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTopic(t);
                        setScreen('candidates');
                      }}
                      className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl bg-stone-800 hover:bg-stone-900 text-white text-sm font-bold"
                    >
                      <MapPin className="w-4 h-4" />
                      후보지 투표 ({candidates.length})
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {screen === 'schedule' && (
          <>
            <div className="bg-white rounded-3xl p-5 border border-stone-200 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  1단계 일정 투표 — <span className="text-amber-700">{currentActor.name}</span>
                </h2>
                <span className="text-xs text-stone-400">달 복수 선택 가능</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {MONTHS.map((m) => {
                  const active = myMonths.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMonth(m)}
                      className={`py-2.5 rounded-2xl text-sm font-bold border transition ${
                        active
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-stone-50 text-stone-700 border-stone-200'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">
                  최대 가능 숙박일 (박)
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {NIGHT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMyMaxNights(n)}
                      className={`py-2 rounded-xl text-xs font-bold border ${
                        myMaxNights === n
                          ? 'bg-stone-800 text-white border-stone-800'
                          : 'bg-stone-50 text-stone-700 border-stone-200'
                      }`}
                    >
                      {n}박{n === 6 ? '+' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">메모 (선택)</label>
                <input
                  type="text"
                  value={myMemo}
                  onChange={(e) => setMyMemo(e.target.value)}
                  placeholder="예: 명절 연휴 피해서 가고 싶어요"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 text-sm"
                />
              </div>
            </div>

            {scheduleSummary.unanimousMonths.length >= 2 && (
              <div className="bg-amber-50 rounded-3xl p-5 border border-amber-300 space-y-3">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold text-sm">
                  <Trophy className="w-4 h-4 text-amber-600" />
                  만장일치 월이 {scheduleSummary.unanimousMonths.length}개 나왔어요! (날씨·가성비 순
                  정렬)
                </div>
                <p className="text-xs text-stone-700">
                  전 연령(70대~2세) 이동 쾌적도와 성수기 부담을 고려해{' '}
                  <strong>{scheduleSummary.unanimousMonths[0]}</strong>을 우선 추천합니다. 최종 결선
                  월을 골라보세요:
                </p>
                <div className="flex flex-wrap gap-2">
                  {scheduleSummary.unanimousMonths.map((m, idx) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRunoffChoice(runoffChoice === m ? '' : m)}
                      className={`px-3.5 py-2 rounded-2xl text-xs font-bold border ${
                        runoffChoice === m
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-stone-800 border-amber-300'
                      }`}
                    >
                      {idx === 0 ? `★ ${m} (추천 1순위)` : `${m} (차선)`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl p-5 border border-stone-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-base">2단계 구체적 날짜 투표</h3>
                <select
                  value={selectedTargetMonth}
                  onChange={(e) => setSelectedTargetMonth(e.target.value)}
                  className="text-xs font-bold bg-stone-100 border border-stone-300 rounded-xl px-2.5 py-1.5"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m} 달력 보기
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-stone-500">
                가능한 날짜를 눌러주세요. 숫자 아래 표시는 가족들이 선택한 횟수입니다.
              </p>

              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const key = `${selectedTargetMonth}-${day}일`;
                  const pickedByMe = mySelectedDates.includes(key);
                  const voteCnt = scheduleSummary.dateCounts[key] || 0;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDate(day)}
                      className={`py-2 rounded-xl border text-center transition ${
                        pickedByMe
                          ? 'bg-amber-500 text-white border-amber-500 font-bold'
                          : 'bg-stone-50 text-stone-800 border-stone-200'
                      }`}
                    >
                      <div className="text-xs">{day}</div>
                      <div
                        className={`text-[10px] ${
                          pickedByMe ? 'text-amber-100' : 'text-stone-400'
                        }`}
                      >
                        {voteCnt > 0 ? `${voteCnt}표` : '-'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {mySelectedDates.length > 0 && (
                <p className="text-xs text-amber-800 font-medium">
                  선택한 날짜: {mySelectedDates.join(', ')}
                </p>
              )}

              <button
                type="button"
                onClick={handleSaveScheduleVote}
                className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {currentActor.name} 일정·날짜 저장하기
              </button>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-stone-200 space-y-3">
              <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                <Sparkles className="w-4 h-4" />
                실시간 일정 집계 & 맞춤 추천 ({destinations.length}개 DB 연동)
              </div>
              <p className="text-sm text-stone-700">
                <strong>기준 월:</strong>{' '}
                {runoffChoice ||
                  (scheduleSummary.topMonths.length > 0
                    ? scheduleSummary.topMonths.join(', ')
                    : '아직 투표 집계 전')}{' '}
                / <strong>기준 박수:</strong> 최대 {scheduleSummary.minAgreedNights}박
              </p>

              <div className="space-y-2.5 pt-1">
                {scheduleSummary.matchedDestinations.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-stone-800">{d.title}</h3>
                      <button
                        type="button"
                        onClick={() => handlePromoteDestination(d)}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-800 text-white shrink-0"
                      >
                        후보로 추가
                      </button>
                    </div>
                    <p className="text-xs text-stone-600">
                      💰 {d.estimated_total_cost} · ✈️ {d.travel_time} · 🏨 {d.accommodation_type}
                    </p>
                    {d.highlights && <p className="text-xs text-stone-700">✨ {d.highlights}</p>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {screen === 'candidates' && (
          <>
            <form
              onSubmit={handleAddCandidate}
              className="bg-white rounded-3xl p-5 border border-stone-200 space-y-2.5"
            >
              <h2 className="font-bold text-base">새 여행지 후보 직접 등록</h2>
              <input
                type="text"
                required
                value={newCand.title}
                onChange={(e) => setNewCand({ ...newCand, title: e.target.value })}
                placeholder="여행지명 (예: 일본 후쿠오카 & 유후인)"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newCand.estimated_total_cost}
                  onChange={(e) => setNewCand({ ...newCand, estimated_total_cost: e.target.value })}
                  placeholder="예상 전체 비용 (예: 약 650만원)"
                  className="px-3 py-2 rounded-xl border border-stone-200 text-sm"
                />
                <input
                  type="text"
                  value={newCand.travel_time}
                  onChange={(e) => setNewCand({ ...newCand, travel_time: e.target.value })}
                  placeholder="이동 시간 (예: 비행 1시간 20분)"
                  className="px-3 py-2 rounded-xl border border-stone-200 text-sm"
                />
              </div>
              <input
                type="text"
                value={newCand.accommodation_type}
                onChange={(e) => setNewCand({ ...newCand, accommodation_type: e.target.value })}
                placeholder="숙소 형태 (예: 료칸 방 3개 / 호텔 3실)"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm"
              />
              <input
                type="text"
                value={newCand.highlights}
                onChange={(e) => setNewCand({ ...newCand, highlights: e.target.value })}
                placeholder="대표 명소 & 추천 포인트"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm"
              />
              <input
                type="url"
                value={newCand.link_url}
                onChange={(e) => setNewCand({ ...newCand, link_url: e.target.value })}
                placeholder="참고 링크 URL (선택)"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-stone-800 text-white font-bold text-sm"
              >
                후보 카드 등록
              </button>
            </form>

            {candidates.map((c) => {
              const votesForCand = candidateVotes.filter((v) => v.candidate_id === c.id);
              const iVoted = votesForCand.some((v) => v.member_id === actingAsMemberId);
              return (
                <div
                  key={c.id}
                  className="bg-white rounded-3xl p-5 border border-stone-200 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold">{c.title}</h3>
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                      {votesForCand.length}표
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">💰 총액: {c.estimated_total_cost || '-'}</p>
                  <p className="text-xs text-stone-600">✈️ 이동: {c.travel_time || '-'}</p>
                  <p className="text-xs text-stone-600">🏨 숙소: {c.accommodation_type || '-'}</p>
                  <p className="text-xs text-stone-700">🎡 명소: {c.highlights || '-'}</p>
                  {c.link_url && (
                    <a
                      href={c.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 underline"
                    >
                      참고 링크 보기 <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleToggleCandidateVote(c.id)}
                      className={`w-full py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5 border ${
                        iVoted
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-stone-50 text-stone-800 border-stone-200'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      {iVoted
                        ? `${currentActor.name} 투표 완료 (취소하려면 클릭)`
                        : `${currentActor.name} 이 곳 투표`}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {screen === 'share' && (
          <div className="bg-white rounded-3xl p-5 border border-stone-200 space-y-3">
            <h2 className="text-lg font-bold">카카오톡 가족방 공유용 요약</h2>
            <pre className="p-4 rounded-2xl bg-stone-100 text-xs whitespace-pre-wrap font-sans leading-relaxed">
              {shareSummaryText}
            </pre>
            <button
              type="button"
              onClick={handleCopyShare}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold"
            >
              요약 텍스트 복사하기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}