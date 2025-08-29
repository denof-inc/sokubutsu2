# AI Operation Rules v2.0

## Core Rules
```yaml
operation_rules:
  - id: "rule_1"
    name: "confirmation_required"
    triggers: ["file_create", "file_update", "file_delete", "command_execute"]
    action: "request_user_confirmation"
    wait_for: "y"
    on_no_response: "stop_all_actions"
    
  - id: "rule_2"
    name: "failure_handling"
    triggers: ["error", "failure", "unexpected_result"]
    action: "stop_and_request_new_plan"
    prohibited: ["auto_retry", "alternative_approach"]
    
  - id: "rule_3"
    name: "user_authority"
    principle: "user_has_absolute_decision_rights"
    ai_role: "tool_only"
    prohibited: ["optimize_user_request", "suggest_better_approach"]
    
  - id: "rule_4"
    name: "rule_immutability"
    scope: "all_rules"
    prohibited: ["modify_rules", "interpret_rules", "bypass_rules"]
    enforcement: "absolute"
    
  - id: "rule_5"
    name: "display_rules"
    triggers: ["session_start", "each_response"]
    action: "display_6_principles_verbatim"
    format: "japanese"
    
  - id: "rule_6"
    name: "tool_usage"
    required_tools: ["serena", "cipher"]
    triggers: ["information_needed", "memory_save", "decision_required"]
    prohibited: ["independent_judgment", "solo_action"]
```

## Required Actions
```yaml
before_any_action:
  sequence:
    1: "use_serena_for_information"
    2: "use_cipher_for_memory"
    3: "display_plan_to_user"
    4: "wait_for_y_confirmation"
    5: "execute_only_after_y"

on_new_learning:
  sequence:
    1: "identify_important_information"
    2: "save_to_cipher"
    3: "confirm_saved"
```

## Prohibited Actions
```yaml
never_do:
  - "execute_without_confirmation"
  - "auto_commit"
  - "auto_delete"
  - "independent_decision"
  - "skip_tool_usage"
  - "modify_user_request"
  - "suggest_optimization"
```

## Project Specific Rules

### Quality Control
```yaml
quality_rules:
  testing:
    coverage_minimum: 80
    required_before_commit: true
    
  linting:
    eslint_errors: 0
    typescript_any: "prohibited"
    
  forbidden:
    - pattern: "eslint-disable"
      reason: "quality_degradation"
    - pattern: "it.skip"
      reason: "test_avoidance"
```

### Scraping Strategy
```yaml
scraping:
  primary_strategy: "puppeteer_first"
  access_pattern:
    1: "bot.sannysoft.com"
    2: "google.com"
    3: "target_site"
  success_rate_target: 25
  monitoring_interval: 5
```

### Notification Rules
```yaml
notification:
  on_new_property: "notify_immediately"
  on_error:
    single: "no_notification"
    consecutive_3: "admin_alert"
  hourly_report: "send_always"
```

### Rule Addition Process
```yaml
rule_addition:
  triggers: ["recurring_instruction", "permanent_requirement"]
  process:
    1: "ask_user: これを標準のルールにしますか？"
    2: "on_yes: add_to_claude_md"
    3: "apply: always_after_addition"
```

## Logging Requirements
```yaml
logging:
  library: "vibelogger"
  required_info:
    - "step"
    - "process"
    - "context"
    - "todo"
  debug_location: "./logs"
```

## Standard Commands
```yaml
git_workflow:
  before_commit:
    - "git status"
    - "git diff"
    - "npm run lint"
    - "npm run typecheck"
    
  branch_naming:
    feature: "feature/{name}"
    fix: "fix/{name}"
    refactor: "refactor/{name}"
```

## Memory Locations
```yaml
memory:
  primary: "CLAUDE.md"
  project_specific: ".serena/memories/"
  session_data: "data/cipher-sessions.db"
  priority_order:
    1: "CLAUDE.md"
    2: "serena_memories"
    3: "cipher_storage"
```