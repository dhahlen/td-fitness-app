# Program engine specification
### Phase 1: intake to program generation

This document defines what the intake form must capture, how each field routes into a training and nutrition decision, and the rules the generator applies. It is written so a developer can implement it without further interpretation, and so you can audit the logic against your own coaching judgment before it ships.

---

## 1. Design principle: every field earns its place

A field belongs in the intake only if it changes an output. Anything that does not change a set count, a calorie target, an exercise selection, or a safety flag is a survey question, not an intake question, and it costs you completion rate.

The generator produces six outputs. Every intake field maps to at least one:

| Output | Driven by |
|---|---|
| Training days per week | Availability, level, goal, recovery capacity |
| Split structure | Days available, level, goal, muscle priorities |
| Weekly volume per muscle | Level, recovery, injury flags, energy phase |
| Exercise selection | Equipment access, injuries, experience, preference |
| Cardio prescription | Goal, level, baseline conditioning, joint history |
| Calorie and macro targets | Body metrics, activity, goal, rate preference, dietary pattern |

---

## 2. Intake structure

Ten sections, ordered so the fastest and least personal questions come first and the drop-off-prone ones come last. Sections 2 and 9 are gates, not questions: a positive answer changes what the system is allowed to produce.

### 2.1 Identity and contact
Name, email, phone, date of birth, sex at birth, time zone.

Sex at birth is required because it is an input to the Mifflin-St Jeor equation and to body fat range interpretation. Label it plainly as being used for metabolic calculation. Date of birth drives the 18+ gate and age-based conditioning adjustments.

### 2.2 Health and safety screening
Implement the PAR-Q+ seven-question core rather than inventing your own. <cite index="40-1">The PAR-Q+ is the international standard for pre-participation screening, and <cite index="35-1">a single "yes" answer on the PAR-Q+ follow-up questions prompts recommendation to seek medical evaluation. Using a recognized instrument also materially improves your position if a client is ever injured.

Questions cover diagnosed heart condition or high blood pressure, chest pain at rest or during activity, dizziness or loss of consciousness, other chronic medical conditions, prescription medication for a chronic condition, joint or bone problems made worse by activity, and physician advice against exercise.

Additional screening beyond PAR-Q+:
- Current pregnancy or postpartum under 12 weeks
- History of or current treatment for an eating disorder
- Cardiac event, surgery, or hospitalization in the past 12 months
- Uncontrolled hypertension, current reading if known

**Routing rules.** Any PAR-Q+ yes sets `medical_clearance_required = true`. The system generates the training outline in a conservative form but holds the prescription until clearance is uploaded or attested. Pregnancy or postpartum routes to manual coach review, not automated generation. A positive eating disorder screen suppresses all numeric calorie, macro, and goal-weight output and routes to you for a referral conversation with a registered dietitian. That last rule is not optional. Serving an aggressive deficit to someone with that history is the single worst failure mode this product has.

### 2.3 Body metrics
Height, current weight, waist and hip circumference, and body fat percentage if known with its measurement method (DEXA, BIA, calipers, visual estimate). Method matters because a BIA reading and a DEXA reading are not interchangeable inputs.

Ask for goal weight separately and validate it. If goal weight implies a BMI under 18.5, or a rate of loss above 1% of body weight per week over the stated timeline, the system flags it and proposes a revised target rather than accepting the input.

### 2.4 Goals and timeline
Primary goal as a single choice, because a client who picks three goals gets a program optimized for none:
- Fat loss with muscle retention
- Muscle gain, lean bias
- Muscle gain, aggressive
- Recomposition
- Strength
- General health and conditioning
- Contest prep

Secondary goal as an optional single choice. Timeline in weeks. Event date if one exists. Muscle group priority ranking, limited to two selections, which the generator uses to bias volume allocation upward within the level cap.

### 2.5 Training history
This section produces the level classification, which is the highest-leverage variable in the whole system. Capture:
- Years of consistent resistance training
- Months of uninterrupted training in the last 12
- Self-rated familiarity with barbell squat, deadlift, bench press, and overhead press, on a scale from never performed to coached and confident
- Estimated or actual one-rep maxes on those four lifts, optional
- Current weekly training frequency
- Competition history and division if any
- Longest previous consistent training block

### 2.6 Schedule and equipment
Days per week available, realistic session length in minutes, preferred training time, and which days are genuinely available. Session length is the field people lie to themselves about. Anchor it with examples.

Equipment access as a multi-select: commercial gym, home gym with barbell and rack, dumbbells only, machines only, bands and bodyweight, specific specialty equipment. Cardio equipment separately, since modality selection depends on it.

### 2.7 Nutrition and lifestyle
Dietary pattern, allergies and intolerances, foods refused, meals per day preferred, cooking capacity, eating out frequency, alcohol per week, current tracking habit, and daily step count or occupational activity level.

Occupational activity is the input for the activity multiplier, and it is more accurate than asking someone to self-rate "moderately active."

### 2.8 Recovery
Average sleep hours, sleep quality, perceived stress, caffeine intake, current soreness patterns, and prior experience with overtraining or burnout. These feed the volume modifier described in section 4.

### 2.9 Injuries and movement limitations
Current pain sites with severity, past injuries and surgeries with dates, movements that reproduce symptoms, and whether the client is under active care from a physical therapist or physician.

This section drives exercise substitution. It needs to be structured data, not a free-text box, so the generator can act on it. Use a body-region picker with severity and an aggravating-movement multi-select, plus an optional free-text field that routes to you.

### 2.10 Preferences and accountability
Exercises loved and hated, check-in frequency preference, progress photo consent, weigh-in frequency, and motivation style. Phase 2 needs a consent flag here for leaderboard visibility, so collect it now rather than retrofitting it.

---

## 3. Training level classification

Do not let clients self-select their level. They are consistently wrong in both directions. Score it.

```
points = 0

Years training:      <0.5 → 0 | 0.5–2 → 2 | 2–5 → 4 | 5+ → 6
Consistency (mo/12): <3   → 0 | 3–6   → 1 | 6–10 → 2 | 10+ → 3
Compound competence: mean of 4 lifts, never=0 → confident=3, rounded
Relative strength:   below novice standard → 0
                     novice to intermediate → 2
                     intermediate to advanced → 4
                     advanced+ → 6
Competition history: none → 0 | amateur → 2 | pro/national → 4

BEGINNER      0–5
NOVICE        6–10
INTERMEDIATE  11–16
ADVANCED      17–21
ELITE         22+
```

Relative strength standards use bodyweight multiples adjusted for sex and body weight. Store them as a lookup table so you can tune them without a code change.

Override rule: anyone scoring intermediate or above who has trained under three months in the last twelve is capped at novice for the first mesocycle. Detraining is real, and returning lifters get hurt when the system treats them as their former selves.

---

## 4. Volume prescription

Volume is the variable with the strongest evidence base. <cite index="2-1">An umbrella review concluded that at least 10 sets per week per muscle group is optimal, and a recent meta-regression found <cite index="3-1">that the probability of volume improving both hypertrophy and strength was 100%, indicating gains increase as volume increases, though both best-fit models suggest diminishing returns, with the diminishing returns for strength being considerably more pronounced.

Weekly hard sets per muscle group, where a hard set is taken within roughly 0 to 4 reps of failure:

| Level | Large muscle groups | Small muscle groups | Priority muscles (max 2) |
|---|---|---|---|
| Beginner | 6–10 | 4–8 | +2 sets |
| Novice | 10–14 | 8–12 | +3 sets |
| Intermediate | 12–18 | 10–16 | +4 sets |
| Advanced | 14–22 | 12–18 | +4 sets |
| Elite | 16–24 | 12–20 | +4 sets |

Large groups: quadriceps, hamstrings, glutes, chest, back, shoulders. Small: biceps, triceps, calves, forearms, abdominals, rear delts.

Count compound lifts as a full set for every prime mover. A set of lat pulldowns counts toward biceps volume the same as a curl does. <cite index="4-1">This 1:1 approach is consistent with a review concluding that equivalent hypertrophy can be achieved with multi-joint compared to single-joint exercise. If you count fractionally instead, your volume caps need to rise proportionally, so pick one convention and hold it.

**Volume modifiers applied after the base allocation:**

```
sleep < 6 hrs/night              ×0.85
perceived stress ≥ 8/10          ×0.85
age ≥ 50                         ×0.90
energy deficit > 20% of TDEE     ×0.90
injury flag on that region       ×0.70 or substitute
returning from 3+ month layoff   ×0.75 for weeks 1–3
```

Modifiers multiply. Floor the result at 6 sets for large groups, since below that you are not training the muscle, you are visiting it.

Start every client at the bottom of their range and add roughly two sets per muscle per week across the mesocycle. That gives you somewhere to go. Programs that open at maximum volume have no progression lever except intensity, which is the wrong lever to pull first.

---

## 5. Split selection

Split follows from days available, level, and goal. This is a lookup, not a judgment call.

### 3 days per week

**Beginner, any goal.** Full body A/B/C, Monday, Wednesday, Friday. Each session: one lower-body push, one lower-body hinge or pull, one horizontal press, one vertical or horizontal pull, one accessory pairing. Five to seven movements, 45 to 60 minutes.

Full body at three days delivers each muscle twice to three times weekly at frequencies that are more than adequate. <cite index="3-1">Frequency's effect on hypertrophy was compatible with negligible effects, while strength gains did increase with frequency, albeit with diminishing returns. For a beginner, the real argument for full body is skill acquisition: they touch the primary movement patterns three times a week instead of once.

**Intermediate or above at 3 days.** Push / pull / legs, run once through. Volume per muscle lands at the low end of the intermediate range, so this configuration is for time-constrained clients, and the system should say so honestly rather than pretending it is optimal.

### 4 days per week

Upper / lower / upper / lower is the default across all levels. Each muscle trained twice weekly, volume distributed evenly, easy to auto-regulate.

Alternative for intermediate and above with a clear priority muscle: upper / lower / priority-biased upper / lower.

### 5 days per week

**Intermediate.** Push / pull / legs / upper / lower. This gets most muscles to a 2 to 2.5x weekly frequency and supports 14 to 18 sets per group without any single session exceeding 75 minutes.

**Advanced and elite.** Body-part focused with isolation on large groups and supersets on small groups, which is the structure you described:

```
Day 1  Chest, primary        + triceps superset
Day 2  Back, primary         + biceps superset
Day 3  Legs, quad-dominant   + calves
Day 4  Shoulders             + arms superset cluster
Day 5  Legs, posterior chain + weak-point work
```

Large groups get straight sets with full rest, 2 to 3 minutes, because that is where the mechanical tension that drives growth comes from. Small groups get antagonist or agonist supersets with 60 to 90 seconds, which buys back session time without meaningfully compromising the stimulus on muscles that recover quickly.

### 6 days per week

Push / pull / legs run twice, or the five-day body-part split plus a dedicated weak-point or conditioning day. Restrict to advanced and elite, and gate it on sleep of at least seven hours and stress under 7 out of 10. Six-day programs fail on recovery, not on programming.

---

## 6. Intensity, rep ranges, and rest

| Goal emphasis | Load | Reps | RIR | Rest |
|---|---|---|---|---|
| Strength, primary lifts | 80–92% 1RM | 1–5 | 1–3 | 3–5 min |
| Hypertrophy, compound | 70–80% 1RM | 6–12 | 1–3 | 2–3 min |
| Hypertrophy, isolation | 60–75% 1RM | 10–15 | 0–2 | 60–90 s |
| Metabolite, finisher | 40–60% 1RM | 15–25 | 0–1 | 45–60 s |

<cite index="1-1">A hypertrophy-oriented program should employ a repetition range of 6 to 12 reps per set with rest intervals of 60 to 90 seconds between sets, with exercises varied in a multiplanar, multiangled fashion to ensure maximal stimulation of all muscle fibers. The 60 to 90 second guidance holds up for isolation work. For compound lifts the more recent evidence favors longer rest, because the limiting factor is systemic fatigue rather than local metabolic stress, so the table above splits the difference by exercise class rather than applying one number to everything.

Beginners get a fixed rep prescription and no RIR targets for the first four to six weeks. They cannot yet estimate proximity to failure, and asking them to leads to either sandbagging or grinding. Introduce RIR once they can self-report a set within one rep of accuracy.

---

## 7. Progression models

Progression is level-dependent. Applying an intermediate model to a beginner wastes their fastest adaptation window; applying a beginner model to an intermediate stalls them in three weeks.

**Beginner and novice: linear load progression.** Add the smallest available increment every session where all prescribed reps were completed. Upper body increments 2.5 lb, lower body 5 lb. Two consecutive failed sessions triggers a 10% deload and rebuild.

**Intermediate: double progression.** Prescribe a rep range. Add reps within the range across sessions, then add load and reset to the bottom of the range once the top is reached on all sets. Layer weekly volume progression on top, adding one set to a priority muscle each week of the accumulation block.

**Advanced and elite: block periodization.** Four to six week accumulation with rising volume, two to three week intensification with rising load and falling volume, one week deload. Rotate primary exercise variations every mesocycle, keep the movement patterns constant.

**Deload rules.** Automatic every fifth or sixth week, or triggered early by any two of: performance regression on the same lift for two sessions, self-reported readiness under 5 out of 10 for four days, resting heart rate elevated 7 or more beats for three days, or sleep under six hours for five consecutive nights. Deload is 50% volume at 85 to 90% of load. Do not cut load and keep volume; that is just a bad training week.

---

## 8. Cardio prescription

Cardio is prescribed, not bolted on. The interference effect is real but has been overstated, and its magnitude depends on choices you control.

The 2012 meta-analysis found that <cite index="30-1">resistance training concurrently with running, but not cycling, resulted in significant decrements in both hypertrophy and strength, with significant negative relationships between frequency and duration of endurance training for hypertrophy, strength, and power. A more recent updated meta-analysis found that for strength outcomes, <cite index="29-1">the modality of endurance training, the weekly frequency, training status, age, and whether both were performed in the same session or different sessions all failed to moderate the effect. Read together: the practical guidance is to control total endurance volume, prefer non-impact modalities when hypertrophy is the priority, and not to panic about scheduling.

On ordering, a systematic review found that <cite index="28-1">a resistance-followed-by-endurance order supports lower-body dynamic strength during a prolonged concurrent training programme, with no support for a given order for static strength, hypertrophy, aerobic capacity, or body fat percentage. So: if both happen in one session, lift first. If they can be separated, separate them.

### Prescription by goal and level

**Beginner, fat loss.** Three sessions of 25 to 35 minutes on non-lifting days, Zone 2, 60 to 70% max heart rate, on a modality that is joint-friendly. Incline walking, cycling, elliptical, rower. Plus a daily step target of 8,000 to 10,000, which usually contributes more to the weekly deficit than the formal sessions do.

**Beginner, muscle gain.** Two sessions of 20 to 25 minutes, low intensity, framed as cardiovascular health and appetite regulation rather than fat loss. Meeting the 150 minutes per week public health floor matters more here than any physique outcome.

**Intermediate, fat loss.** Three to four sessions. Two Zone 2 of 30 to 40 minutes, one or two intervals of 15 to 20 minutes total work, placed on non-lifting days or separated from lifting by at least six hours. Cycling and rowing preferred over running when leg volume is high.

**Intermediate to advanced, muscle gain.** Two sessions of 20 to 30 minutes low intensity. Cap it. Cardio is not the growth stimulus and every extra session is recovery you could have spent on volume.

**Advanced, contest prep.** Start low and escalate. The rule is to add cardio before cutting calories further once intake approaches the floor, because preserving food intake preserves training quality. Cap total weekly cardio at 240 to 300 minutes and monitor strength retention as the stop signal.

**Hard cap when hypertrophy is the priority:** 180 minutes per week of formal cardio. Above that, volume-driven decrements become likely.

---

## 9. Nutrition engine

### 9.1 Baseline energy expenditure

Use Mifflin-St Jeor when body fat percentage is unknown or self-estimated, Katch-McArdle when a measured body fat percentage from DEXA or a competent BIA is available.

```
Mifflin-St Jeor (kcal/day):
  male    BMR = 10·kg + 6.25·cm − 5·age + 5
  female  BMR = 10·kg + 6.25·cm − 5·age − 161

Katch-McArdle:
  BMR = 370 + (21.6 · lean_body_mass_kg)
```

### 9.2 Activity multiplier

Derive from occupational activity plus step count rather than a self-rated label, then add the training load separately so the multiplier does not double-count workouts.

```
Sedentary desk job, <5k steps        1.20
Desk job, 5–8k steps                 1.30
Light activity, 8–12k steps          1.45
Physically active job, 12k+ steps    1.60
Heavy labor                          1.75

+ 0.025 per weekly resistance session
+ 0.020 per weekly cardio session
```

### 9.3 Energy target by goal

**Fat loss.** Target rate is 0.5 to 1% of body weight per week. <cite index="42-1">Caloric intake should be set at a level that results in bodyweight losses of approximately 0.5 to 1% per week to maximize muscle retention, and the same review notes that <cite index="43-1">diets longer than two to four months yielding weight loss of approximately 0.5 to 1% of bodyweight weekly may be superior for lean body mass retention compared to shorter or more aggressive diets. Set the rate by starting body fat: <cite index="11-1">the higher the baseline body fat level, the more aggressively the caloric deficit may be imposed, and slower rates of weight loss can better preserve lean mass in leaner subjects.

```
Body fat > 30% (m) / > 38% (f)   →  0.8–1.0% BW/week
Body fat 20–30% (m) / 28–38% (f) →  0.6–0.8%
Body fat 12–20% (m) / 20–28% (f) →  0.5–0.6%
Body fat < 12% (m) / < 20% (f)   →  0.25–0.5%
```

**Hard floors, enforced in code, not in guidance text:**
- Deficit never exceeds 25% of TDEE
- Calories never fall below calculated BMR
- Absolute floor of 1,500 kcal for men and 1,200 for women, and hitting that floor routes to manual coach review rather than being served automatically
- Goal weight producing a BMI under 18.5 is rejected at input

**Muscle gain.** <cite index="24-1">A hyper-energetic diet of roughly 10 to 20% above maintenance should be consumed with a target weight gain of about 0.25 to 0.5% of bodyweight per week for novice and intermediate lifters, with advanced bodybuilders being more conservative with both the caloric surplus and weekly weight gain.

```
Beginner/novice      +15–20% over TDEE   →  0.4–0.5% BW/week
Intermediate         +10–15%             →  0.25–0.4%
Advanced/elite       +5–10%              →  0.15–0.25%
```

**Recomposition.** Maintenance to +5%, protein at the top of the range, and success measured by strength and circumference rather than scale weight. Set this expectation in the delivered program or the client will quit at week three.

**Maintenance and general health.** TDEE, with a 200 kcal band rather than a single number.

### 9.4 Macronutrients

Set protein first, fat second, carbohydrate as the remainder.

**Protein.** <cite index="13-1">For building and maintaining muscle mass, an overall daily protein intake in the range of 1.4 to 2.0 g/kg/day is sufficient for most exercising individuals, while higher intakes of 2.3 to 3.1 g/kg/day may be needed to maximize retention of lean body mass in resistance-trained subjects during hypocaloric periods.

```
Maintenance or surplus, any level      1.6–2.2 g/kg body weight
Deficit, beginner to novice            1.8–2.2 g/kg body weight
Deficit, intermediate and above        2.3–3.1 g/kg lean body mass
Contest prep                           2.3–3.1 g/kg lean body mass
```

Where lean body mass is unknown, 2.0 to 2.2 g/kg of body weight is a reasonable substitute for lean clients.

**Fat.** <cite index="24-1">Fat should be consumed in moderate amounts, 0.5 to 1.5 g/kg/day. In a deficit, hold a floor at 15 to 20% of total calories. Dropping below that to make room for carbohydrate is where hormonal complaints start.

**Carbohydrate.** Everything remaining. <cite index="24-1">In a surplus, target at least 3 to 5 g/kg/day to support the energy demands of resistance exercise. In a deep deficit carbohydrate gets squeezed, and that is the trade-off to explain in the delivered document rather than hide.

**Distribution.** <cite index="24-1">Optimal amounts are 0.40 to 0.55 g/kg per meal, distributed evenly across 3 to 6 meals, including within 1 to 2 hours pre- and post-training. Total intake matters far more than timing, so present meal structure as a practical adherence tool, not as a mechanism.

**Fiber and fluid.** 14 g fiber per 1,000 kcal, 35 ml water per kg body weight plus 500 to 750 ml per training hour.

### 9.5 Adjustment loop

Recalculate every two weeks against actual trend weight, not the raw daily number.

```
Actual rate vs target rate
  within ±20%       hold
  too slow by >20%  adjust calories by 5–8% in the goal direction
  too fast by >20%  adjust 5–8% back toward maintenance
  weight flat 3 wks in a deficit → check adherence before cutting further
```

Weight stalls are an adherence problem far more often than a metabolism problem. Build the adherence check into the check-in flow so the system asks before it cuts.

---

## 10. Exercise database requirements

The generator is only as good as the library behind it. Each entry needs:

```
id, name, aliases
movement_pattern      squat | hinge | horizontal_push | vertical_push |
                      horizontal_pull | vertical_pull | lunge | carry | isolation
prime_movers[]        with muscle ids
secondary_movers[]
equipment_required[]
skill_level           1–5
setup_complexity      1–3
substitutions[]       ordered, with equipment and injury tags
contraindications[]   injury region ids
unilateral            boolean
loading_type          barbell | dumbbell | machine | cable | bodyweight | band
superset_compatible[] exercise ids that pair well
video_url, coaching_cues[]
```

Minimum viable library is roughly 120 exercises: 40 primary compounds with variations, 60 isolation movements, 20 conditioning. The substitution graph is what makes equipment and injury handling work, so build it as real relationships rather than a free-text note.

---

## 11. Generated program output

Each client receives:

1. Program summary with level classification, split rationale, and mesocycle length
2. Week-by-week training schedule with exercise, sets, rep range, RIR target, rest, and tempo where it matters
3. Load prescriptions as percentages of estimated 1RM for advanced clients, and as an RPE-anchored starting-weight protocol for beginners
4. Cardio schedule with modality options, duration, and heart rate or RPE zones
5. Calorie and macro targets with a meal-structure template
6. Progression rules stated in plain language so the client knows when to add weight
7. Deload week placement
8. Check-in schedule with the specific metrics to log
9. Substitution list for the three most likely equipment gaps

Deliver as a PDF and inside the app. The PDF is what they show people, and that matters for referrals.

---

## 12. Phase 2: gamification outline

Recording the requirements now so the phase 1 data model does not block them.

**Scoring must be relative, not absolute.** A leaderboard ranking by total weight lifted hands every position to the heaviest men in the group and tells everyone else the game is not for them. Score on rate of change against the individual's own baseline.

Proposed composite, weekly:

```
Consistency      40 pts   sessions completed / sessions prescribed
Progression      30 pts   estimated 1RM change across tracked lifts,
                          normalized by level (beginners gain faster,
                          so divide by an expected-rate coefficient)
Body composition 20 pts   movement toward the client's own goal,
                          capped so faster is never better
Engagement       10 pts   check-ins logged, photos submitted, streak
```

**Design constraints that follow from the wellness risk:**
- Never leaderboard raw weight lost or body fat percentage. Score movement toward a target, and cap the score at the target so exceeding it earns nothing.
- Cap points for weight change at the prescribed safe rate. Losing 3 lb in a week must not outscore losing 1.5 lb.
- Opt-in visibility, set per metric. Some clients will share lifting numbers and not weight.
- Cohort by level and goal so beginners compete with beginners.
- Streaks reset gently. A missed week should not erase eight good ones, or the system punishes the exact people who need to come back.

Squad or team challenges outperform individual leaderboards for retention in the beginner segment, which is most of your book. Two to four person teams with a shared consistency target keeps the bottom half engaged instead of driving them off the board.

**Data model additions needed in phase 1:** consent flags per metric, baseline snapshot at program start, session completion events with timestamps, and a per-lift estimated 1RM history. Add these columns now.

---

## 13. Open decisions for you

1. Level standards table. The strength thresholds need to reflect your client base, not a generic chart. Give me your read on what an intermediate bench looks like for your population and I will encode it.
2. Whether beginners get 1RM estimation at all, or start with an RPE-based load-finding protocol for the first block. I lean toward the latter.
3. Contest prep clients. This spec handles them, but the failure cost is high and the volume is low. Consider routing all contest prep to manual programming with the engine producing a first draft only.
4. Whether the intake is gated behind payment. It changes how much abandonment you can tolerate and therefore how long the form can be.
5. Liability review. The medical screening and clearance logic should be looked at by someone who handles fitness professional liability in your state before launch.

---

## References

Schoenfeld, Ogborn & Krieger (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. Journal of Sports Sciences 35(11).
Bernardez-Vazquez et al. (2022). Resistance training variables for optimization of muscle hypertrophy: an umbrella review. Frontiers in Sports and Active Living.
Pelland et al. (2024/2025). The resistance training dose-response: meta-regressions on weekly volume and frequency. Sports Medicine.
Jäger et al. (2017). ISSN position stand: protein and exercise. JISSN 14:20.
Aragon et al. (2017). ISSN position stand: diets and body composition. JISSN 14:16.
Helms, Aragon & Fitschen (2014). Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. JISSN 11:20.
Iraki et al. (2019). Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports 7(7).
Wilson et al. (2012). Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. JSCR 26(8).
Schumann et al. (2022). Compatibility of concurrent aerobic and strength training for skeletal muscle size and function: updated systematic review and meta-analysis. Sports Medicine 52(3).
Eddens, van Someren & Howatson (2018). The role of intra-session exercise sequence in the interference effect. Sports Medicine 48.
Riebe et al. (2015). Updating ACSM's recommendations for exercise preparticipation health screening. MSSE 47(8).
Warburton et al. PAR-Q+ and ePARmed-X+. eparmedx.com
