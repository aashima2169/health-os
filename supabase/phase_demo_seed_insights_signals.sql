-- ============================================================================
-- Fictional demo data for Insights (blood report trend, A1 Blood
-- Intelligence, A3 Health Intelligence + specialist board) and Signals.
-- Run AFTER phase_demo_seed.sql, same demo user_id. Safe to re-run —
-- blood_reports only inserts if the demo account has none yet,
-- agent_insights/signals upsert on their real unique constraints.
-- ============================================================================

do $$
declare
  v_demo_user_id uuid := 'a33f88c0-b260-4b34-9754-0455af77e645';
  v_report_prev_id uuid;
  v_report_latest_id uuid;
begin

  -- ── Two blood reports, ~60 days apart, so the "Worth Watching" trend
  -- chart on Insights has something to plot ──────────────────────────
  if not exists (select 1 from blood_reports where user_id = v_demo_user_id) then
    insert into blood_reports (user_id, report_date, markers, notes, extraction_status)
    values (
      v_demo_user_id, current_date - 62,
      replace('{
        "CRP": {"value": 6.2, "unit": "mg/L", "reference": "0 - 5.0"},
        "ESR": {"value": 22, "unit": "mm/hr", "reference": "0 - 20"},
        "Vitamin D": {"value": 22, "unit": "ng/mL", "reference": "30 - 100"},
        "Ferritin": {"value": 45, "unit": "ng/mL", "reference": "20 - 200"},
        "Hemoglobin": {"value": 11.8, "unit": "g/dL", "reference": "12.0 - 15.5"}
      }', chr(10), ' ')::jsonb,
      'Routine panel', 'success'
    ) returning id into v_report_prev_id;

    insert into blood_reports (user_id, report_date, markers, notes, extraction_status)
    values (
      v_demo_user_id, current_date - 8,
      replace('{
        "CRP": {"value": 3.8, "unit": "mg/L", "reference": "0 - 5.0"},
        "ESR": {"value": 14, "unit": "mm/hr", "reference": "0 - 20"},
        "Vitamin D": {"value": 31, "unit": "ng/mL", "reference": "30 - 100"},
        "Ferritin": {"value": 38, "unit": "ng/mL", "reference": "20 - 200"},
        "Hemoglobin": {"value": 12.4, "unit": "g/dL", "reference": "12.0 - 15.5"}
      }', chr(10), ' ')::jsonb,
      'Follow-up panel', 'success'
    ) returning id into v_report_latest_id;
  end if;

  -- ── A1 Blood Intelligence ────────────────────────────────────────
  insert into agent_insights (user_id, agent_id, period, version, result, status, generated_at)
  values (
    v_demo_user_id, 'A1', 'all', 'demo',
    replace('{
      "has_data": true,
      "latest_date": "' || (current_date - 8)::text || '",
      "previous_date": "' || (current_date - 62)::text || '",
      "overall_summary": "Inflammatory markers have improved noticeably since your last report, while Vitamin D continues to trend upward. Ferritin remains on the lower end of the range, worth keeping an eye on.",
      "by_system": [
        {
          "system": "Inflammation",
          "system_summary": "CRP and ESR both dropped meaningfully, consistent with fewer flares reported this period.",
          "markers": [
            {"name": "CRP", "value": 3.8, "unit": "mg/L", "reference": "0 - 5.0", "status": "normal", "plain_language": "Within normal range, and about 40% lower than your last report.", "change": "improved", "previous_value": 6.2},
            {"name": "ESR", "value": 14, "unit": "mm/hr", "reference": "0 - 20", "status": "normal", "plain_language": "Improved and comfortably within range.", "change": "improved", "previous_value": 22}
          ]
        },
        {
          "system": "Iron & Blood Health",
          "system_summary": "Hemoglobin is healthy; ferritin is still on the lower side of normal.",
          "markers": [
            {"name": "Ferritin", "value": 38, "unit": "ng/mL", "reference": "20 - 200", "status": "borderline_low", "plain_language": "Low-normal — not flagged as deficient, but worth tracking alongside energy levels.", "change": "stable", "previous_value": 45},
            {"name": "Hemoglobin", "value": 12.4, "unit": "g/dL", "reference": "12.0 - 15.5", "status": "normal", "plain_language": "Healthy, and slightly improved.", "change": "improved", "previous_value": 11.8}
          ]
        },
        {
          "system": "Vitamins",
          "system_summary": "Vitamin D has climbed steadily across your last two reports.",
          "markers": [
            {"name": "Vitamin D", "value": 31, "unit": "ng/mL", "reference": "30 - 100", "status": "normal", "plain_language": "Just crossed into the normal range — supplementation appears to be helping.", "change": "improved", "previous_value": 22}
          ]
        }
      ],
      "flags": [
        {"marker": "Ferritin", "status": "borderline_low", "note": "Still on the lower end — worth a follow-up panel in a few months.", "suggest_doctor_discussion": true}
      ],
      "improved": ["CRP", "ESR", "Vitamin D", "Hemoglobin"],
      "worsened": [],
      "stable": ["Ferritin"],
      "questions_for_doctor": ["Given ferritin has stayed low-normal across two reports, would iron supplementation make sense?"],
      "report_count": 2,
      "confidence": 78,
      "disclaimer": "This is a pattern summary, not a diagnosis — always confirm with your doctor."
    }', chr(10), ' ')::jsonb,
    'success', now()
  )
  on conflict (user_id, agent_id, period) do update
    set result = excluded.result, status = 'success', generated_at = now();

  -- ── A3 Health Intelligence (consolidator + full specialist board) —
  -- seeded for both 'week' and 'month' since those are the two most-
  -- clicked period tabs ────────────────────────────────────────────
  insert into agent_insights (user_id, agent_id, period, version, result, status, generated_at)
  select v_demo_user_id, 'A3', p, 'demo',
    replace(('{
      "period": "' || p || '",
      "has_data": true,
      "summary": "This period''s data points to **stress and short sleep** as the most consistent thread behind your symptoms, echoed independently by three specialists.",
      "biggest_change": "Inflammatory markers (CRP, ESR) are meaningfully improved since your last blood report.",
      "what_deserves_attention_this_week": "Ferritin is still on the lower end — worth monitoring alongside energy levels over the next few reports.",
      "to_do": ["Keep logging sleep and stress daily — this is your strongest signal right now", "Bring the ferritin trend to your next physician visit"],
      "to_check": ["Whether energy dips track more closely with sleep or with stress on days both are low"],
      "cross_specialty_insights": [
        {
          "insight": "Stress and short sleep appeared together before the flare logged this period, independently flagged by the Physician, Dermatologist, and Psychologist.",
          "specialists": ["A3a", "A3b", "A3c"],
          "evidence": "Flare onset followed two consecutive nights under 6 hours of sleep and a stress rating of 7+.",
          "confidence": 72,
          "other_possible_explanation": "Could also be a coincidental overlap with a dietary change during the same window."
        }
      ],
      "points_of_agreement": ["Inflammatory markers are trending in the right direction", "Sleep consistency is the most actionable lever right now"],
      "points_of_divergence": ["Nutritionist sees a possible dietary link the Gut specialist rates as too early to call"],
      "questions_worth_exploring_with_your_doctor": ["Would it be worth rechecking ferritin sooner than the usual interval, given the trend?"],
      "board": {
        "physician": {
          "has_data": true,
          "summary": "Overall picture is improving — inflammatory markers down, energy still inconsistent.",
          "data_reviewed": ["2 blood panels", "6 days of check-ins"],
          "key_findings": ["CRP and ESR both improved since last report", "Energy levels correlate more with sleep than any single other factor logged"],
          "action_items": ["Continue current supplement routine", "Recheck ferritin in 6-8 weeks"],
          "questions_for_this_specialty": ["Has iron intake changed recently?"],
          "confidence": 75,
          "confidence_note": "Based on 2 blood panels and consistent recent logging."
        },
        "dermatologist": {
          "has_data": true,
          "summary": "One flare logged this period, consistent with the prior stress-linked pattern.",
          "data_reviewed": ["1 logged flare", "6 days of check-ins"],
          "key_findings": ["Flare preceded by 2 nights of short sleep and elevated stress"],
          "action_items": ["Note any new skincare products introduced around flare onset"],
          "questions_for_this_specialty": [],
          "confidence": 62,
          "confidence_note": "Single flare this period — pattern is suggestive, not yet confirmed."
        },
        "psychologist": {
          "has_data": true,
          "summary": "Stress ratings above 6 preceded the only flare logged this period.",
          "data_reviewed": ["6 days of mood/stress logs"],
          "key_findings": ["Stress was the most temporally consistent factor ahead of the flare"],
          "action_items": ["Consider a short breathing practice on days stress trends upward two days running"],
          "questions_for_this_specialty": ["Would a same-day check-in reminder on high-stress days be useful?"],
          "confidence": 68,
          "confidence_note": "Based on a short observation window — worth confirming over more weeks."
        },
        "gutMicrobiomeDoctor": {
          "has_data": true,
          "summary": "Digestion logged as steady this period — no strong signal yet.",
          "data_reviewed": ["6 days of meal logs"],
          "key_findings": ["No clear digestive pattern around the flare window"],
          "action_items": [],
          "questions_for_this_specialty": ["Worth logging digestion specifically, not just meals, going forward?"],
          "confidence": 40,
          "confidence_note": "Too little data yet to say much with confidence."
        },
        "nutritionist": {
          "has_data": true,
          "summary": "One outside meal overlapped with the days leading into the flare.",
          "data_reviewed": ["6 days of meal logs"],
          "key_findings": ["A social-outing meal fell inside the flare''s lookback window"],
          "action_items": ["Note ingredients next time a similar meal precedes a symptom change"],
          "questions_for_this_specialty": [],
          "confidence": 45,
          "confidence_note": "Single occurrence — not yet a pattern."
        },
        "tcmPractitioner": {
          "has_data": true,
          "summary": "Presentation this period is consistent with a mild qi-stagnation pattern.",
          "data_reviewed": ["6 days of check-ins"],
          "key_findings": ["Energy and mood patterns loosely align with a stress-related TCM presentation"],
          "action_items": ["Consider discussing with a licensed TCM practitioner if pursuing this alongside conventional care"],
          "questions_for_this_specialty": [],
          "confidence": 35,
          "confidence_note": "Framing only — not a conventional diagnosis."
        }
      }
    }'), chr(10), ' ')::jsonb,
    'success', now()
  from unnest(array['week', 'month']) as p
  on conflict (user_id, agent_id, period) do update
    set result = excluded.result, status = 'success', generated_at = now();

  -- ── Signals — three fictional hypotheses at different stages ───────
  insert into signals (
    user_id, topic_key, title, hypothesis, status, confidence, confidence_trend,
    suggested_experiment, contributing_factors, contradictions, missing_information,
    confidence_history, possible_explanations, first_generated_at, last_updated_at
  )
  values
  (
    v_demo_user_id, 'stress-sleep-flare',
    'Stress and short sleep before your **flares**',
    'In the days before each logged flare, your stress ratings were elevated and sleep ran short — a pattern worth continuing to watch.',
    'active', 75, 'increasing',
    'Try a 10-minute wind-down routine on nights after a high-stress day, and see if next-day energy holds steadier.',
    '[{"factor": "Elevated stress (7+/10)", "evidence_summary": "Present in the 2 days before the logged flare", "source_specialists": ["A3c"]}, {"factor": "Short sleep (<6h)", "evidence_summary": "Two consecutive nights under 6 hours preceded flare onset", "source_specialists": ["A3a"]}]'::jsonb,
    '[]'::jsonb,
    '[{"what": "A few more flare occurrences", "why_it_would_help": "Confirms whether this is a consistent precursor or a one-off coincidence"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('date', now() - interval '20 days', 'confidence', 55, 'note', 'First seen'),
      jsonb_build_object('date', now(), 'confidence', 75, 'note', 'Reinforced by the most recent flare')
    ),
    '[{"explanation": "Direct physiological stress load", "note": "Prolonged stress and poor sleep can plausibly affect inflammatory regulation"}, {"explanation": "Reduced self-care during stressful stretches", "note": "Stress may also indirectly reduce diet quality, movement, or supplement consistency — not just a direct biological link"}]'::jsonb,
    now() - interval '20 days', now()
  ),
  (
    v_demo_user_id, 'humidity-skin',
    'The impact of **monsoon humidity** on your skin',
    'Skin-related flares showed up more often on days with higher humidity readings, especially combined with exercise.',
    'resolved', 70, 'stable',
    null,
    '[{"factor": "Humidity above 70%", "evidence_summary": "Present on the days immediately before both skin flares this period", "source_specialists": ["A3b"]}]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('date', now() - interval '35 days', 'confidence', 60, 'note', 'First seen'),
      jsonb_build_object('date', now() - interval '5 days', 'confidence', 70, 'note', 'Confirmed by you')
    ),
    '[{"explanation": "Sweat and friction irritation", "note": "Humid conditions combined with movement can increase skin friction and moisture retention"}, {"explanation": "Seasonal allergen exposure", "note": "Humidity often coincides with higher pollen/mold exposure, a separate possible contributor"}]'::jsonb,
    now() - interval '35 days', now() - interval '5 days'
  ),
  (
    v_demo_user_id, 'dairy-digestion',
    'Possible link between **dairy** and digestion',
    'Digestion scores dipped on a couple of days that followed dairy-containing meals, but there isn''t enough data yet to call this a real pattern.',
    'needs_more_data', 40, 'new',
    'Log digestion specifically (not just meals) for a couple of weeks to build a clearer picture.',
    '[{"factor": "Dairy-containing outside meals", "evidence_summary": "Present before 2 of the lower-digestion days logged", "source_specialists": ["A3d"]}]'::jsonb,
    '[{"description": "One low-digestion day had no dairy logged at all, so this may not be the full explanation", "specialists_involved": ["A3d"]}]'::jsonb,
    '[{"what": "Dedicated digestion ratings", "why_it_would_help": "Meal logs alone don''t capture symptom severity directly"}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('date', now(), 'confidence', 40, 'note', 'First seen')
    ),
    '[{"explanation": "Lactose sensitivity", "note": "A common and plausible angle given the timing"}, {"explanation": "Coincidental timing with an unrelated stressor", "note": "Too few data points yet to rule this out"}]'::jsonb,
    now(), now()
  )
  on conflict (user_id, topic_key) do update
    set title = excluded.title, hypothesis = excluded.hypothesis, status = excluded.status,
        confidence = excluded.confidence, confidence_trend = excluded.confidence_trend,
        suggested_experiment = excluded.suggested_experiment,
        contributing_factors = excluded.contributing_factors, contradictions = excluded.contradictions,
        missing_information = excluded.missing_information, confidence_history = excluded.confidence_history,
        possible_explanations = excluded.possible_explanations, last_updated_at = excluded.last_updated_at;

end $$;
