# { "Depends": "py-genlayer:test" }
from genlayer import *

import json


class LoreDuel(gl.Contract):
    scene: str
    last_verdict: str
    verdicts_by_submission: str
    recent_submission_ids: str

    def __init__(self, scene: str):
        self.scene = scene
        self.last_verdict = json.dumps(
            {
                "winner": "draw",
                "player_loss": 0,
                "rival_loss": 0,
                "tension_shift": 0,
                "narration": "The duel has not started.",
                "oracle_line": "Consensus is waiting for the opening move.",
                "scene_shift": scene,
                "applied_statuses": {"player": [], "rival": []},
                "cleared_statuses": {"player": [], "rival": []},
                "stance_delta": {"player": "bulwark", "rival": "bulwark"},
                "tactical_reason": "No tactical exchange has been recorded yet.",
            },
            sort_keys=True,
        )
        self.verdicts_by_submission = json.dumps({}, sort_keys=True)
        self.recent_submission_ids = json.dumps([])

    @gl.public.write
    def submit_turn(
        self,
        scene_name: str,
        scene_detail: str,
        player_move: str,
        rival_move: str,
        player_stance: str,
        rival_stance: str,
        prior_memory: str,
        submission_id: str,
    ) -> None:
        self._validate_submission_id(submission_id)

        prompt = f"""
You are the oracle for a dramatic fantasy duel.
Judge only one turn.

Arena: {self.scene}
Scene name: {scene_name}
Scene detail: {scene_detail}
Player move: {player_move}
Rival move: {rival_move}
Player stance: {player_stance}
Rival stance: {rival_stance}
Recent memory: {prior_memory}

Return JSON only with exactly these keys:
- winner: "player" | "rival" | "draw"
- player_loss: integer 1..4
- rival_loss: integer 1..4
- tension_shift: integer 8..18
- narration: string
- oracle_line: string
- scene_shift: string
- applied_statuses: object with keys player and rival, each an array chosen from ["guarded","burning","shaken","focused"]
- cleared_statuses: object with keys player and rival, each an array chosen from ["guarded","burning","shaken","focused"]
- stance_delta: object with keys player and rival, each one of ["bulwark","trickster","eclipse"]
- tactical_reason: string
"""

        def leader_fn():
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            self._validate_verdict(result)
            return result

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False

            try:
                self._validate_verdict(leader_result.calldata)
            except Exception:
                return False

            return True

        verdict = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        self.last_verdict = json.dumps(verdict, sort_keys=True)
        self._store_submission_verdict(submission_id, verdict)

    @gl.public.view
    def get_last_verdict(self) -> str:
        return self.last_verdict

    @gl.public.view
    def get_verdict(self, submission_id: str) -> str:
        verdicts = json.loads(self.verdicts_by_submission)
        return verdicts.get(submission_id, "")

    def _validate_verdict(self, verdict) -> None:
        if not isinstance(verdict, dict):
            raise ValueError("Verdict must be an object")

        required_keys = {
            "winner",
            "player_loss",
            "rival_loss",
            "tension_shift",
            "narration",
            "oracle_line",
            "scene_shift",
            "applied_statuses",
            "cleared_statuses",
            "stance_delta",
            "tactical_reason",
        }

        if set(verdict.keys()) != required_keys:
            raise ValueError("Verdict keys mismatch")

        if verdict["winner"] not in ("player", "rival", "draw"):
            raise ValueError("Invalid winner")

        if not isinstance(verdict["player_loss"], int) or not 1 <= verdict["player_loss"] <= 4:
            raise ValueError("Invalid player_loss")

        if not isinstance(verdict["rival_loss"], int) or not 1 <= verdict["rival_loss"] <= 4:
            raise ValueError("Invalid rival_loss")

        if not isinstance(verdict["tension_shift"], int) or not 8 <= verdict["tension_shift"] <= 18:
            raise ValueError("Invalid tension_shift")

        for key in ("narration", "oracle_line", "scene_shift", "tactical_reason"):
            value = verdict[key]
            if not isinstance(value, str) or len(value.strip()) < 12:
                raise ValueError(f"Invalid text field: {key}")

        for key in ("applied_statuses", "cleared_statuses"):
            self._validate_status_group(verdict[key], key)

        self._validate_stance_delta(verdict["stance_delta"])

    def _validate_status_group(self, status_group, field_name: str) -> None:
        if not isinstance(status_group, dict):
            raise ValueError(f"{field_name} must be an object")

        if set(status_group.keys()) != {"player", "rival"}:
            raise ValueError(f"{field_name} keys mismatch")

        for side in ("player", "rival"):
            value = status_group[side]
            if not isinstance(value, list):
                raise ValueError(f"{field_name}.{side} must be a list")

            for status in value:
                if status not in ("guarded", "burning", "shaken", "focused"):
                    raise ValueError(f"Invalid status in {field_name}.{side}")

    def _validate_stance_delta(self, stance_delta) -> None:
        if not isinstance(stance_delta, dict):
            raise ValueError("stance_delta must be an object")

        if set(stance_delta.keys()) != {"player", "rival"}:
            raise ValueError("stance_delta keys mismatch")

        for side in ("player", "rival"):
            if stance_delta[side] not in ("bulwark", "trickster", "eclipse"):
                raise ValueError(f"Invalid stance_delta.{side}")

    def _validate_submission_id(self, submission_id: str) -> None:
        if not isinstance(submission_id, str):
            raise ValueError("submission_id must be a string")

        trimmed = submission_id.strip()
        if len(trimmed) < 8 or len(trimmed) > 160:
            raise ValueError("submission_id length is invalid")

    def _store_submission_verdict(self, submission_id: str, verdict) -> None:
        verdicts = json.loads(self.verdicts_by_submission)
        recent_ids = json.loads(self.recent_submission_ids)

        verdicts[submission_id] = json.dumps(verdict, sort_keys=True)
        recent_ids.append(submission_id)

        if len(recent_ids) > 24:
            stale_id = recent_ids.pop(0)
            if stale_id in verdicts:
                del verdicts[stale_id]

        self.verdicts_by_submission = json.dumps(verdicts, sort_keys=True)
        self.recent_submission_ids = json.dumps(recent_ids)
