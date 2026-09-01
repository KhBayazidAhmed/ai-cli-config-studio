/**
 * AI CLI Config Studio - Terminal Command Generators
 * Generates platform-specific setup and rollback commands that safely merge
 * configurations directly into client config files with timestamped backups.
 */

/** Default reasoning effort written for every client and every model. */
const DEFAULT_EFFORT = "medium";

// ============================================================================
// 1. Claude Code (~/.claude/settings.json)
// ============================================================================

function powershellValueDeclarations({ baseUrl = "", apiKey = "", model = "" }) {
  return `$baseUrl = ${powershellQuotedValue(baseUrl)}; $apiKey = ${powershellQuotedValue(apiKey)}; $model = ${powershellQuotedValue(model)}`;
}

function unixQuotedValue(value = "") {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function powershellQuotedValue(value = "") {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizeGatewayBaseUrl(value = "") {
  const url = new URL(String(value));
  let path = url.pathname.replace(/\/+$/, "").replace(/\/models$/, "");
  if (!path) path = "/v1";
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function normalizeClaudeBaseUrl(value = "") {
  const url = new URL(normalizeGatewayBaseUrl(value));
  url.pathname = url.pathname.replace(/\/v1$/, "") || "/";
  return url.toString().replace(/\/$/, "");
}

function opencodeModel(model = "") {
  return `config-studio/${model}`;
}

function buildClaudeSessionSettings({ baseUrl, apiKey, model }) {
  return JSON.stringify({
    model,
    effortLevel: DEFAULT_EFFORT,
    modelSettings: {
      [model]: { effortLevel: DEFAULT_EFFORT },
    },
    env: {
      ANTHROPIC_BASE_URL: normalizeClaudeBaseUrl(baseUrl),
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_MODEL: model,
      CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
    },
  });
}

function buildOpenCodeConfig({ baseUrl, apiKey, model }) {
  return JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    model: opencodeModel(model),
    provider: {
      "config-studio": {
        npm: "@ai-sdk/openai-compatible",
        name: "Config Studio Gateway",
        options: {
          baseURL: normalizeGatewayBaseUrl(baseUrl),
          apiKey,
        },
        models: {
          [model]: {
            name: model,
            options: { reasoningEffort: DEFAULT_EFFORT },
          },
        },
      },
    },
  });
}

const pythonSetupScript = `import json,os,pathlib,re
c=os.environ["HC_CLIENT"]; h=pathlib.Path.home(); p={"claude":h/".claude/settings.json","codex":h/".codex/config.toml","aider":h/".aider.conf.yml","opencode":h/".config/opencode/opencode.json"}[c]
d=lambda k:os.environ[k]
b,k,m=d("HC_BASE"),d("HC_KEY"),d("HC_MODEL")
if c=="aider":
 s=p.read_text() if p.exists() else ""; lines=[x for x in s.splitlines() if not x.startswith(("openai-api-base:","openai-api-key:","model:","reasoning-effort:"))]
 while lines and not lines[-1]: lines.pop()
 if lines: lines.append("")
 lines += ["openai-api-base: "+json.dumps(b,ensure_ascii=False),"openai-api-key: "+json.dumps(k,ensure_ascii=False),"model: "+json.dumps(m,ensure_ascii=False),'reasoning-effort: "medium"']; p.write_text("\\n".join(lines)+"\\n")
elif c=="codex":
 s=p.read_text() if p.exists() else ""; out=[]; skipping=False; inserted=False
 root=["model = "+json.dumps(m,ensure_ascii=False),"model_provider = \\\"config-studio\\\"","model_reasoning_effort = \\\"medium\\\""]
 for line in s.splitlines():
  stripped=line.strip()
  if stripped.startswith("[") and stripped.endswith("]"):
   if not inserted: out.extend(root+[""]); inserted=True
   if stripped=="[model_providers.config-studio]": skipping=True; continue
   skipping=False
  if skipping or (not inserted and re.match(r"^\\s*(model|model_provider|model_reasoning_effort)\\s*=",line)): continue
  out.append(line)
 if not inserted: out.extend(([""] if out else [])+root)
 while out and not out[-1]: out.pop()
 out += ["","[model_providers.config-studio]","name = \\\"Config Studio Gateway\\\"","base_url = "+json.dumps(b,ensure_ascii=False),"experimental_bearer_token = "+json.dumps(k,ensure_ascii=False),"wire_api = \\\"responses\\\""]
 p.write_text("\\n".join(out)+"\\n")
else:
 try: x=json.loads(p.read_text())
 except Exception: x={}
 if not isinstance(x,dict): x={}
 if c=="claude": x["env"]={**(x.get("env") if isinstance(x.get("env"),dict) else {}),"ANTHROPIC_BASE_URL":b,"ANTHROPIC_AUTH_TOKEN":k,"ANTHROPIC_MODEL":m,"CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY":"1"}; x["model"]=m; x["effortLevel"]="medium"; ms=x.get("modelSettings") if isinstance(x.get("modelSettings"),dict) else {}; me=ms.get(m) if isinstance(ms.get(m),dict) else {}; me["effortLevel"]="medium"; ms[m]=me; x["modelSettings"]=ms
 else:
  x["$schema"]="https://opencode.ai/config.json"; x["model"]="config-studio/"+m; providers=x.get("provider") if isinstance(x.get("provider"),dict) else {}; provider=providers.get("config-studio") if isinstance(providers.get("config-studio"),dict) else {}; provider.update(npm="@ai-sdk/openai-compatible",name="Config Studio Gateway"); options=provider.get("options") if isinstance(provider.get("options"),dict) else {}; options.update(baseURL=b,apiKey=k); provider["options"]=options; models=provider.get("models") if isinstance(provider.get("models"),dict) else {}; entry=models.get(m) if isinstance(models.get(m),dict) else {}; entry["name"]=m; entry["options"]={**(entry.get("options") if isinstance(entry.get("options"),dict) else {}),"reasoningEffort":"medium"}; models[m]=entry; provider["models"]=models; providers["config-studio"]=provider; x["provider"]=providers
 p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+"\\n")`;

const perlSetupScript = `use strict; use warnings; use JSON::PP;
my $c=$ENV{HC_CLIENT}; my $h=$ENV{HOME}; my %p=(claude=>"$h/.claude/settings.json",codex=>"$h/.codex/config.toml",aider=>"$h/.aider.conf.yml",opencode=>"$h/.config/opencode/opencode.json"); my $p=$p{$c};
my $d=sub { $ENV{$_[0]} }; my ($b,$k,$m)=map { $d->($_) } qw(HC_BASE HC_KEY HC_MODEL); my $j=JSON::PP->new->utf8->pretty;
if($c eq "aider"){ my @l; if(open my $f,"<",$p){ local $/; @l=split /\\r?\\n/,<$f> } @l=grep { !/^(?:openai-api-base|openai-api-key|model|reasoning-effort):/ } @l; pop @l while @l && $l[-1] eq ""; push @l,"" if @l; my $q=JSON::PP->new->allow_nonref; push @l,"openai-api-base: ".$q->encode($b),"openai-api-key: ".$q->encode($k),"model: ".$q->encode($m),'reasoning-effort: "medium"'; open my $f,">",$p or die $!; print $f join("\\n",@l),"\\n" }
elsif($c eq "codex"){ my @l; if(open my $f,"<",$p){ local $/; @l=split /\\r?\\n/,<$f> } my @o; my $skip=0; my $inserted=0; my @root=('model = '.JSON::PP->new->allow_nonref->encode($m),'model_provider = "config-studio"','model_reasoning_effort = "medium"'); for my $line(@l){ my $s=$line; $s=~s/^\\s+|\\s+$//g; if($s=~/^\\[.*\\]$/){ if(!$inserted){ push @o,@root,""; $inserted=1 } if($s eq '[model_providers.config-studio]'){ $skip=1; next } $skip=0 } next if $skip || (!$inserted && $line=~/^\\s*(?:model|model_provider|model_reasoning_effort)\\s*=/); push @o,$line } push @o,(scalar(@o)?"":()),@root unless $inserted; pop @o while @o && $o[-1] eq ""; my $q=JSON::PP->new->allow_nonref; push @o,"",'[model_providers.config-studio]','name = "Config Studio Gateway"','base_url = '.$q->encode($b),'experimental_bearer_token = '.$q->encode($k),'wire_api = "responses"'; open my $f,">",$p or die $!; print $f join("\\n",@o),"\\n" }
else { my $x={}; if(open my $f,"<",$p){ local $/; my $raw=<$f>; my $v=eval { $j->decode($raw) }; $x=$v if ref($v) eq "HASH" } if($c eq "claude"){ $x->{env}={} unless ref($x->{env}) eq "HASH"; @{$x->{env}}{qw(ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_MODEL CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY)}=($b,$k,$m,"1"); $x->{model}=$m; $x->{effortLevel}="medium"; $x->{modelSettings}={} unless ref($x->{modelSettings}) eq "HASH"; $x->{modelSettings}{$m}={} unless ref($x->{modelSettings}{$m}) eq "HASH"; $x->{modelSettings}{$m}{effortLevel}="medium" } else { $x->{'$schema'}="https://opencode.ai/config.json"; $x->{model}="config-studio/$m"; $x->{provider}={} unless ref($x->{provider}) eq "HASH"; my $provider=$x->{provider}{'config-studio'}; $provider={} unless ref($provider) eq "HASH"; $provider->{npm}="\\@ai-sdk/openai-compatible"; $provider->{name}="Config Studio Gateway"; $provider->{options}={} unless ref($provider->{options}) eq "HASH"; @{$provider->{options}}{qw(baseURL apiKey)}=($b,$k); $provider->{models}={} unless ref($provider->{models}) eq "HASH"; $provider->{models}{$m}={} unless ref($provider->{models}{$m}) eq "HASH"; $provider->{models}{$m}{name}=$m; $provider->{models}{$m}{options}={} unless ref($provider->{models}{$m}{options}) eq "HASH"; $provider->{models}{$m}{options}{reasoningEffort}="medium"; $x->{provider}{'config-studio'}=$provider } open my $f,">",$p or die $!; print $f $j->encode($x) }`;

const macSetupScript = `ObjC.import("Foundation"); const e=$.NSProcessInfo.processInfo.environment; const v=k=>ObjC.unwrap(e.objectForKey(k)); const c=v("HC_CLIENT"),h=v("HOME"),p={claude:h+"/.claude/settings.json",codex:h+"/.codex/config.toml",aider:h+"/.aider.conf.yml",opencode:h+"/.config/opencode/opencode.json"}[c],b=v("HC_BASE"),k=v("HC_KEY"),m=v("HC_MODEL"); let s=""; try{s=ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null))||""}catch(_){} if(c==="aider"){let l=s.split(/\\r?\\n/).filter(x=>!(/^(openai-api-base|openai-api-key|model|reasoning-effort):/.test(x)));while(l.length&&!l[l.length-1])l.pop();if(l.length)l.push("");l.push("openai-api-base: "+JSON.stringify(b),"openai-api-key: "+JSON.stringify(k),"model: "+JSON.stringify(m),'reasoning-effort: "medium"');s=l.join("\\n")+"\\n"}else if(c==="codex"){let out=[],skip=false,inserted=false,root=["model = "+JSON.stringify(m),'model_provider = "config-studio"','model_reasoning_effort = "medium"'];for(const line of s.split(/\\r?\\n/)){const t=line.trim();if(t.startsWith("[")&&t.endsWith("]")){if(!inserted){out.push(...root,"");inserted=true}if(t==="[model_providers.config-studio]"){skip=true;continue}skip=false}if(skip||(!inserted&&/^\\s*(model|model_provider|model_reasoning_effort)\\s*=/.test(line)))continue;out.push(line)}if(!inserted){if(out.length)out.push("");out.push(...root)}while(out.length&&!out[out.length-1])out.pop();out.push("","[model_providers.config-studio]",'name = "Config Studio Gateway"',"base_url = "+JSON.stringify(b),"experimental_bearer_token = "+JSON.stringify(k),'wire_api = "responses"');s=out.join("\\n")+"\\n"}else{let x={};try{x=JSON.parse(s)}catch(_){}if(!x||Array.isArray(x)||typeof x!=="object")x={};if(c==="claude"){x.env=Object.assign({},x.env,{ANTHROPIC_BASE_URL:b,ANTHROPIC_AUTH_TOKEN:k,ANTHROPIC_MODEL:m,CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY:"1"});x.model=m;x.effortLevel="medium";x.modelSettings=Object.assign({},x.modelSettings);x.modelSettings[m]=Object.assign({},x.modelSettings[m],{effortLevel:"medium"})}else{x.$schema="https://opencode.ai/config.json";x.model="config-studio/"+m;x.provider=Object.assign({},x.provider);const provider=Object.assign({},x.provider["config-studio"],{npm:"@ai-sdk/openai-compatible",name:"Config Studio Gateway"});provider.options=Object.assign({},provider.options,{baseURL:b,apiKey:k});provider.models=Object.assign({},provider.models);provider.models[m]=Object.assign({},provider.models[m],{name:m});provider.models[m].options=Object.assign({},provider.models[m].options,{reasoningEffort:"medium"});x.provider["config-studio"]=provider}s=JSON.stringify(x,null,2)+"\\n"} $(s).writeToFileAtomicallyEncodingError(p,true,$.NSUTF8StringEncoding,null);`;

function selectedPythonSetupScript(client) {
  const path = JSON.stringify({
    claude: ".claude/settings.json",
    codex: ".codex/config.toml",
    aider: ".aider.conf.yml",
    opencode: ".config/opencode/opencode.json",
  }[client]);
  const prelude = `import json,os,pathlib,re
h=pathlib.Path.home();p=h/${path};b=os.environ["HC_BASE"];k=os.environ["HC_KEY"];m=os.environ["HC_MODEL"]`;

  if (client === "aider") return `${prelude}
s=p.read_text() if p.exists() else "";lines=[x for x in s.splitlines() if not x.startswith(("openai-api-base:","openai-api-key:","model:","reasoning-effort:"))]
while lines and not lines[-1]:lines.pop()
if lines:lines.append("")
lines += ["openai-api-base: "+json.dumps(b),"openai-api-key: "+json.dumps(k),"model: "+json.dumps(m),'reasoning-effort: "medium"'];p.write_text("\\n".join(lines)+"\\n")`;

  if (client === "codex") return `${prelude}
s=p.read_text() if p.exists() else "";out=[];skip=False;inserted=False;root=["model = "+json.dumps(m),'model_provider = "config-studio"','model_reasoning_effort = "medium"']
for line in s.splitlines():
 t=line.strip()
 if t.startswith("[") and t.endswith("]"):
  if not inserted:out.extend(root+[""]);inserted=True
  if t=="[model_providers.config-studio]":skip=True;continue
  skip=False
 if skip or (not inserted and re.match(r"^\\s*(model|model_provider|model_reasoning_effort)\\s*=",line)):continue
 out.append(line)
if not inserted:out.extend(([""] if out else [])+root)
while out and not out[-1]:out.pop()
out += ["","[model_providers.config-studio]",'name = "Config Studio Gateway"',"base_url = "+json.dumps(b),"experimental_bearer_token = "+json.dumps(k),'wire_api = "responses"'];p.write_text("\\n".join(out)+"\\n")`;

  if (client === "claude") return `${prelude}
try:x=json.loads(p.read_text())
except Exception:x={}
if not isinstance(x,dict):x={}
x["env"]={**(x.get("env") if isinstance(x.get("env"),dict) else {}),"ANTHROPIC_BASE_URL":b,"ANTHROPIC_AUTH_TOKEN":k,"ANTHROPIC_MODEL":m,"CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY":"1"};x["model"]=m;x["effortLevel"]="medium";ms=x.get("modelSettings") if isinstance(x.get("modelSettings"),dict) else {};me=ms.get(m) if isinstance(ms.get(m),dict) else {};me["effortLevel"]="medium";ms[m]=me;x["modelSettings"]=ms;p.write_text(json.dumps(x,indent=2)+"\\n")`;

  return `${prelude}
try:x=json.loads(p.read_text())
except Exception:x={}
if not isinstance(x,dict):x={}
x["$schema"]="https://opencode.ai/config.json";x["model"]="config-studio/"+m;providers=x.get("provider") if isinstance(x.get("provider"),dict) else {};provider=providers.get("config-studio") if isinstance(providers.get("config-studio"),dict) else {};provider.update(npm="@ai-sdk/openai-compatible",name="Config Studio Gateway");options=provider.get("options") if isinstance(provider.get("options"),dict) else {};options.update(baseURL=b,apiKey=k);provider["options"]=options;models=provider.get("models") if isinstance(provider.get("models"),dict) else {};entry=models.get(m) if isinstance(models.get(m),dict) else {};entry["name"]=m;entry["options"]={**(entry.get("options") if isinstance(entry.get("options"),dict) else {}),"reasoningEffort":"medium"};models[m]=entry;provider["models"]=models;providers["config-studio"]=provider;x["provider"]=providers;p.write_text(json.dumps(x,indent=2)+"\\n")`;
}

function selectedPerlSetupScript(client) {
  const path = {
    claude: ".claude/settings.json",
    codex: ".codex/config.toml",
    aider: ".aider.conf.yml",
    opencode: ".config/opencode/opencode.json",
  }[client];
  const prelude = `use strict;use warnings;use JSON::PP;my $p=$ENV{HOME}."/${path}";my($b,$k,$m)=@ENV{qw(HC_BASE HC_KEY HC_MODEL)};my $j=JSON::PP->new->utf8->pretty;`;

  if (client === "aider") return `${prelude}my @l;if(open my $f,"<",$p){local $/;@l=split /\\r?\\n/,<$f>}@l=grep{!/^(?:openai-api-base|openai-api-key|model|reasoning-effort):/}@l;pop @l while @l&&$l[-1] eq "";push @l,"" if @l;my $q=JSON::PP->new->allow_nonref;push @l,"openai-api-base: ".$q->encode($b),"openai-api-key: ".$q->encode($k),"model: ".$q->encode($m),'reasoning-effort: "medium"';open my $f,">",$p or die $!;print $f join("\\n",@l),"\\n";`;
  if (client === "codex") return `${prelude}my @l;if(open my $f,"<",$p){local $/;@l=split /\\r?\\n/,<$f>}my(@o,$skip,$inserted);my @root=('model = '.JSON::PP->new->allow_nonref->encode($m),'model_provider = "config-studio"','model_reasoning_effort = "medium"');for my $line(@l){(my $s=$line)=~s/^\\s+|\\s+$//g;if($s=~/^\\[.*\\]$/){if(!$inserted){push @o,@root,"";$inserted=1}if($s eq '[model_providers.config-studio]'){$skip=1;next}$skip=0}next if $skip||(!$inserted&&$line=~/^\\s*(?:model|model_provider|model_reasoning_effort)\\s*=/);push @o,$line}push @o,(scalar(@o)?"":()),@root unless $inserted;pop @o while @o&&$o[-1] eq "";my $q=JSON::PP->new->allow_nonref;push @o,"",'[model_providers.config-studio]','name = "Config Studio Gateway"','base_url = '.$q->encode($b),'experimental_bearer_token = '.$q->encode($k),'wire_api = "responses"';open my $f,">",$p or die $!;print $f join("\\n",@o),"\\n";`;
  if (client === "claude") return `${prelude}my $x={};if(open my $f,"<",$p){local $/;my $v=eval{$j->decode(<$f>)};$x=$v if ref($v) eq "HASH"}$x->{env}={} unless ref($x->{env}) eq "HASH";@{$x->{env}}{qw(ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_MODEL CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY)}=($b,$k,$m,"1");$x->{model}=$m;$x->{effortLevel}="medium";$x->{modelSettings}={} unless ref($x->{modelSettings}) eq "HASH";$x->{modelSettings}{$m}={} unless ref($x->{modelSettings}{$m}) eq "HASH";$x->{modelSettings}{$m}{effortLevel}="medium";open my $f,">",$p or die $!;print $f $j->encode($x);`;
  return `${prelude}my $x={};if(open my $f,"<",$p){local $/;my $v=eval{$j->decode(<$f>)};$x=$v if ref($v) eq "HASH"}$x->{'$schema'}="https://opencode.ai/config.json";$x->{model}="config-studio/$m";$x->{provider}={} unless ref($x->{provider}) eq "HASH";my $v=$x->{provider}{'config-studio'};$v={} unless ref($v) eq "HASH";$v->{npm}="\\@ai-sdk/openai-compatible";$v->{name}="Config Studio Gateway";$v->{options}={} unless ref($v->{options}) eq "HASH";@{$v->{options}}{qw(baseURL apiKey)}=($b,$k);$v->{models}={} unless ref($v->{models}) eq "HASH";$v->{models}{$m}={} unless ref($v->{models}{$m}) eq "HASH";$v->{models}{$m}{name}=$m;$v->{models}{$m}{options}={} unless ref($v->{models}{$m}{options}) eq "HASH";$v->{models}{$m}{options}{reasoningEffort}="medium";$x->{provider}{'config-studio'}=$v;open my $f,">",$p or die $!;print $f $j->encode($x);`;
}

function selectedMacSetupScript(client) {
  const path = {
    claude: ".claude/settings.json",
    codex: ".codex/config.toml",
    aider: ".aider.conf.yml",
    opencode: ".config/opencode/opencode.json",
  }[client];
  const prelude = `ObjC.import("Foundation");const e=$.NSProcessInfo.processInfo.environment,v=n=>ObjC.unwrap(e.objectForKey(n)),p=v("HOME")+"/${path}",b=v("HC_BASE"),k=v("HC_KEY"),m=v("HC_MODEL");let s="";try{s=ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null))||""}catch(_){};`;
  const write = `$(s).writeToFileAtomicallyEncodingError(p,true,$.NSUTF8StringEncoding,null);`;

  if (client === "aider") return `${prelude}let l=s.split(/\\r?\\n/).filter(x=>!(/^(openai-api-base|openai-api-key|model|reasoning-effort):/.test(x)));while(l.length&&!l[l.length-1])l.pop();if(l.length)l.push("");l.push("openai-api-base: "+JSON.stringify(b),"openai-api-key: "+JSON.stringify(k),"model: "+JSON.stringify(m),'reasoning-effort: "medium"');s=l.join("\\n")+"\\n";${write}`;
  if (client === "codex") return `${prelude}let o=[],skip=false,inserted=false,root=["model = "+JSON.stringify(m),'model_provider = "config-studio"','model_reasoning_effort = "medium"'];for(const line of s.split(/\\r?\\n/)){const t=line.trim();if(t.startsWith("[")&&t.endsWith("]")){if(!inserted){o.push(...root,"");inserted=true}if(t==="[model_providers.config-studio]"){skip=true;continue}skip=false}if(skip||(!inserted&&/^\\s*(model|model_provider|model_reasoning_effort)\\s*=/.test(line)))continue;o.push(line)}if(!inserted){if(o.length)o.push("");o.push(...root)}while(o.length&&!o[o.length-1])o.pop();o.push("","[model_providers.config-studio]",'name = "Config Studio Gateway"',"base_url = "+JSON.stringify(b),"experimental_bearer_token = "+JSON.stringify(k),'wire_api = "responses"');s=o.join("\\n")+"\\n";${write}`;
  if (client === "claude") return `${prelude}let x={};try{x=JSON.parse(s)}catch(_){}if(!x||Array.isArray(x)||typeof x!=="object")x={};x.env=Object.assign({},x.env,{ANTHROPIC_BASE_URL:b,ANTHROPIC_AUTH_TOKEN:k,ANTHROPIC_MODEL:m,CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY:"1"});x.model=m;x.effortLevel="medium";x.modelSettings=Object.assign({},x.modelSettings);x.modelSettings[m]=Object.assign({},x.modelSettings[m],{effortLevel:"medium"});s=JSON.stringify(x,null,2)+"\\n";${write}`;
  return `${prelude}let x={};try{x=JSON.parse(s)}catch(_){}if(!x||Array.isArray(x)||typeof x!=="object")x={};x.$schema="https://opencode.ai/config.json";x.model="config-studio/"+m;x.provider=Object.assign({},x.provider);const q=Object.assign({},x.provider["config-studio"],{npm:"@ai-sdk/openai-compatible",name:"Config Studio Gateway"});q.options=Object.assign({},q.options,{baseURL:b,apiKey:k});q.models=Object.assign({},q.models);q.models[m]=Object.assign({},q.models[m],{name:m});q.models[m].options=Object.assign({},q.models[m].options,{reasoningEffort:"medium"});x.provider["config-studio"]=q;s=JSON.stringify(x,null,2)+"\\n";${write}`;
}

function unixPermanentCommand(client, values, directory, configPath) {
  const model = client === "aider" && !values.model.startsWith("openai/")
    ? `openai/${values.model}`
    : values.model;
  const baseUrl = client === "claude"
    ? normalizeClaudeBaseUrl(values.baseUrl)
    : normalizeGatewayBaseUrl(values.baseUrl);
  const environment = [
    `export HC_CLIENT=${unixQuotedValue(client)}`,
    `export HC_BASE=${unixQuotedValue(baseUrl)}`,
    `export HC_KEY=${unixQuotedValue(values.apiKey)}`,
    `export HC_MODEL=${unixQuotedValue(model)}`,
  ].join("\n");
  const clientName = {
    claude: "Claude Code",
    codex: "Codex CLI",
    aider: "Aider",
    opencode: "OpenCode",
  }[client] || "AI CLI";
  const pythonSetupScript = selectedPythonSetupScript(client);
  const perlSetupScript = selectedPerlSetupScript(client);
  const macSetupScript = selectedMacSetupScript(client);

  return `(\n${environment}\n\nprintf '%s\\n' '[1/4] Preparing ${clientName} permanent configuration.'\nprintf '%s\\n' '      Config file: ${configPath}'\n\nif command -v python3 >/dev/null 2>&1; then\n  hc_runtime=python3\nelif command -v perl >/dev/null 2>&1 && perl -MJSON::PP -e 1 >/dev/null 2>&1; then\n  hc_runtime=perl\nelif [ "$(uname -s)" = Darwin ] && command -v osascript >/dev/null 2>&1; then\n  hc_runtime=osascript\nelse\n  printf '%s\\n' 'Setup could not find a built-in JSON runtime (Python 3, Perl, or macOS JavaScript).' >&2\n  exit 1\nfi\n\nmkdir -p "${directory}"\nif [ -f "${configPath}" ]; then\n  printf '%s\\n' '[2/4] Backing up the existing configuration.'\n  cp "${configPath}" "${configPath}.bak-$(date +%Y%m%d-%H%M%S)"\nelse\n  printf '%s\\n' '[2/4] No existing configuration found; creating a new one.'\nfi\n\nprintf '%s\\n' '[3/4] Saving the gateway and selected model.'\ncase "$hc_runtime" in\n  python3)\n    python3 <<'CONFIG_STUDIO_PY'\n${pythonSetupScript}\nCONFIG_STUDIO_PY\n    ;;\n  perl)\n    perl <<'CONFIG_STUDIO_PERL'\n${perlSetupScript}\nCONFIG_STUDIO_PERL\n    ;;\n  osascript)\n    osascript -l JavaScript <<'CONFIG_STUDIO_JXA'\n${macSetupScript}\nCONFIG_STUDIO_JXA\n    ;;\nesac\n)`;
}

const temporaryEnvironmentNames = {
  claude: {
    baseUrl: "ANTHROPIC_BASE_URL",
    apiKey: "ANTHROPIC_AUTH_TOKEN",
    model: "ANTHROPIC_MODEL",
  },
  codex: {
    baseUrl: "OPENAI_BASE_URL",
    apiKey: "OPENAI_API_KEY",
    model: "CODEX_MODEL",
  },
  aider: {
    baseUrl: "OPENAI_API_BASE",
    apiKey: "OPENAI_API_KEY",
    model: "AIDER_MODEL",
  },
  opencode: {
    baseUrl: "OPENAI_BASE_URL",
    apiKey: "OPENAI_API_KEY",
    model: "OPENCODE_MODEL",
  },
};

function appendInteractiveLaunch(platform, target, command, launch = true, mode = "permanent") {
  if (!launch) return command;

  const message = mode === "temporary"
    ? `Temporary settings ready. Opening ${target.name} with the selected model.`
    : `[4/4] Configuration saved. Opening ${target.name} with the selected model.`;

  if (platform === "windows") {
    return `${command}; if ($?) { Write-Host '${message}' -ForegroundColor Green; if (Get-Command '${target.executable}' -ErrorAction SilentlyContinue) { ${target.windows} } else { Write-Error '${target.name} is not installed or is not available in PATH.' } }`;
  }

  return `${command} && printf '%s\\n' '${message}' && if command -v ${target.executable} >/dev/null 2>&1; then ${target.unix}; else printf '%s\\n' '${target.name} is not installed or is not available in PATH.' >&2; exit 1; fi`;
}

function windowsPermanentProgress(client, command) {
  const details = {
    claude: ["Claude Code", "$HOME\\.claude\\settings.json"],
    codex: ["Codex CLI", "$HOME\\.codex\\config.toml"],
    aider: ["Aider", "$HOME\\.aider.conf.yml"],
    opencode: ["OpenCode", "$HOME\\.config\\opencode\\opencode.json"],
  }[client] || ["AI CLI", "the client configuration file"];

  return `Write-Host '[1/4] Preparing ${details[0]} permanent configuration.'; Write-Host '      Config file: ${details[1]}'; Write-Host '[2/4] Backing up any existing configuration.'; Write-Host '[3/4] Saving the gateway and selected model.'; ${command}`;
}

function permanentLaunchTarget(client, model) {
  if (client === "codex") {
    return {
      name: "Codex CLI",
      executable: "codex",
      unix: `codex --model ${unixQuotedValue(model)}`,
      windows: `codex --model ${powershellQuotedValue(model)}`,
    };
  }
  if (client === "opencode") {
    const selectedModel = opencodeModel(model);
    return {
      name: "OpenCode",
      executable: "opencode",
      unix: `opencode --model ${unixQuotedValue(selectedModel)}`,
      windows: `opencode --model ${powershellQuotedValue(selectedModel)}`,
    };
  }
  if (client === "aider") {
    const selectedModel = model.startsWith("openai/") ? model : `openai/${model}`;
    return {
      name: "Aider",
      executable: "aider",
      unix: `aider --model ${unixQuotedValue(selectedModel)}`,
      windows: `aider --model ${powershellQuotedValue(selectedModel)}`,
    };
  }
  return {
    name: "Claude Code",
    executable: "claude",
    unix: `claude --model ${unixQuotedValue(model)}`,
    windows: `claude --model ${powershellQuotedValue(model)}`,
  };
}

function temporaryCommandParts(platform, values) {
  const client = values.client || "claude";
  const isWindows = platform === "windows";
  const quote = isWindows ? powershellQuotedValue : unixQuotedValue;
  const separator = isWindows ? "; " : " && ";
  const env = (name, value) => isWindows
    ? `$env:${name} = ${quote(value)}`
    : `export ${name}=${quote(value)}`;

  if (client === "claude") {
    const baseUrl = normalizeClaudeBaseUrl(values.baseUrl);
    const settings = buildClaudeSessionSettings({ ...values, baseUrl });
    return {
      command: [
        env("ANTHROPIC_BASE_URL", baseUrl),
        env("ANTHROPIC_AUTH_TOKEN", values.apiKey),
        env("ANTHROPIC_MODEL", values.model),
      ].join(separator),
      target: {
        name: "Claude Code",
        executable: "claude",
        unix: `claude --settings ${unixQuotedValue(settings)} --model "$ANTHROPIC_MODEL"`,
        windows: `claude --settings ${powershellQuotedValue(settings)} --model $env:ANTHROPIC_MODEL`,
      },
    };
  }

  if (client === "codex") {
    const baseUrl = normalizeGatewayBaseUrl(values.baseUrl);
    const overrides = [
      'model_provider="config-studio"',
      'model_providers.config-studio.name="Config Studio Gateway"',
      `model_providers.config-studio.base_url=${JSON.stringify(baseUrl)}`,
      'model_providers.config-studio.env_key="OPENAI_API_KEY"',
      'model_providers.config-studio.wire_api="responses"',
      'model_reasoning_effort="medium"',
    ];
    const args = overrides.map((value) => `-c ${quote(value)}`).join(" ");
    return {
      command: [
        env("OPENAI_BASE_URL", baseUrl),
        env("OPENAI_API_KEY", values.apiKey),
        env("CODEX_MODEL", values.model),
      ].join(separator),
      target: {
        name: "Codex CLI",
        executable: "codex",
        unix: `codex --model "$CODEX_MODEL" ${args}`,
        windows: `codex --model $env:CODEX_MODEL ${args}`,
      },
    };
  }

  if (client === "opencode") {
    const config = buildOpenCodeConfig(values);
    const model = opencodeModel(values.model);
    return {
      command: [
        env("OPENAI_BASE_URL", normalizeGatewayBaseUrl(values.baseUrl)),
        env("OPENAI_API_KEY", values.apiKey),
        env("OPENCODE_MODEL", model),
        env("OPENCODE_CONFIG_CONTENT", config),
      ].join(separator),
      target: {
        name: "OpenCode",
        executable: "opencode",
        unix: 'opencode --model "$OPENCODE_MODEL"',
        windows: "opencode --model $env:OPENCODE_MODEL",
      },
    };
  }

  const names = temporaryEnvironmentNames.aider;
  const model = values.model.startsWith("openai/") ? values.model : `openai/${values.model}`;
  return {
    command: [
      env(names.baseUrl, normalizeGatewayBaseUrl(values.baseUrl)),
      env(names.apiKey, values.apiKey),
      env(names.model, model),
    ].join(separator),
    target: {
      name: "Aider",
      executable: "aider",
      unix: 'aider --model "$AIDER_MODEL" --reasoning-effort medium',
      windows: "aider --model $env:AIDER_MODEL --reasoning-effort medium",
    },
  };
}

function claudeUnixCommand({ baseUrl, apiKey, model }) {
  return unixPermanentCommand("claude", { baseUrl, apiKey, model }, "$HOME/.claude", "$HOME/.claude/settings.json");
}

function claudeWindowsCommand({ baseUrl, apiKey, model }) {
  const normalizedBaseUrl = normalizeClaudeBaseUrl(baseUrl);
  return `${powershellValueDeclarations({ baseUrl: normalizedBaseUrl, apiKey, model })}; $configDir = Join-Path $HOME '.claude'; $config = Join-Path $configDir 'settings.json'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; $data = [PSCustomObject]@{}; if (Test-Path $config) { try { $data = Get-Content $config -Raw | ConvertFrom-Json } catch {} }; if (-not ($data.PSObject.Properties['env'])) { $data | Add-Member -MemberType NoteProperty -Name 'env' -Value ([PSCustomObject]@{}) -Force }; $data.env | Add-Member -MemberType NoteProperty -Name 'ANTHROPIC_BASE_URL' -Value $baseUrl -Force; $data.env | Add-Member -MemberType NoteProperty -Name 'ANTHROPIC_AUTH_TOKEN' -Value $apiKey -Force; $data.env | Add-Member -MemberType NoteProperty -Name 'ANTHROPIC_MODEL' -Value $model -Force; $data.env | Add-Member -MemberType NoteProperty -Name 'CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY' -Value '1' -Force; $data | Add-Member -MemberType NoteProperty -Name 'model' -Value $model -Force; $data | Add-Member -MemberType NoteProperty -Name 'effortLevel' -Value 'medium' -Force; if (-not ($data.PSObject.Properties['modelSettings'])) { $data | Add-Member -MemberType NoteProperty -Name 'modelSettings' -Value ([PSCustomObject]@{}) -Force }; $data.modelSettings | Add-Member -MemberType NoteProperty -Name $model -Value ([PSCustomObject]@{ effortLevel = 'medium' }) -Force; $data | ConvertTo-Json -Depth 10 | Set-Content -Path $config -Encoding UTF8`;
}

// ============================================================================
// 2. Codex CLI (~/.codex/config.toml)
// ============================================================================

function codexUnixCommand({ baseUrl, apiKey, model }) {
  return unixPermanentCommand("codex", { baseUrl, apiKey, model }, "$HOME/.codex", "$HOME/.codex/config.toml");
}

function codexWindowsCommand({ baseUrl, apiKey, model }) {
  const normalizedBaseUrl = normalizeGatewayBaseUrl(baseUrl);
  return `${powershellValueDeclarations({ baseUrl: normalizedBaseUrl, apiKey, model })}; $configDir = Join-Path $HOME '.codex'; $config = Join-Path $configDir 'config.toml'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"; $lines = @(Get-Content $config) } else { $lines = @() }; $out = [Collections.Generic.List[string]]::new(); $inserted = $false; $skipping = $false; $root = @('model = ' + ($model | ConvertTo-Json -Compress), 'model_provider = "config-studio"', 'model_reasoning_effort = "medium"'); foreach ($line in $lines) { $trimmed = $line.Trim(); if ($trimmed.StartsWith('[') -and $trimmed.EndsWith(']')) { if (-not $inserted) { foreach ($item in $root) { $out.Add($item) }; $out.Add(''); $inserted = $true }; if ($trimmed -eq '[model_providers.config-studio]') { $skipping = $true; continue }; $skipping = $false }; if ($skipping -or ((-not $inserted) -and $line -match '^\\s*(model|model_provider|model_reasoning_effort)\\s*=')) { continue }; $out.Add($line) }; if (-not $inserted) { if ($out.Count) { $out.Add('') }; foreach ($item in $root) { $out.Add($item) } }; while ($out.Count -and -not $out[$out.Count - 1]) { $out.RemoveAt($out.Count - 1) }; $out.Add(''); $out.Add('[model_providers.config-studio]'); $out.Add('name = "Config Studio Gateway"'); $out.Add('base_url = ' + ($baseUrl | ConvertTo-Json -Compress)); $out.Add('experimental_bearer_token = ' + ($apiKey | ConvertTo-Json -Compress)); $out.Add('wire_api = "responses"'); $out | Set-Content -Path $config -Encoding UTF8`;
}

// ============================================================================
// 3. Aider (~/.aider.conf.yml)
// ============================================================================

function aiderUnixCommand({ baseUrl, apiKey, model }) {
  return unixPermanentCommand("aider", { baseUrl, apiKey, model }, "$HOME", "$HOME/.aider.conf.yml");
}

function aiderWindowsCommand({ baseUrl, apiKey, model }) {
  const normalizedBaseUrl = normalizeGatewayBaseUrl(baseUrl);
  const modelName = model.startsWith("openai/") ? model : `openai/${model}`;

  return `${powershellValueDeclarations({ baseUrl: normalizedBaseUrl, apiKey, model: modelName })}; $config = Join-Path $HOME '.aider.conf.yml'; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"; $lines = @(Get-Content $config | Where-Object { $_ -notmatch '^(openai-api-base|openai-api-key|model|reasoning-effort):' }) } else { $lines = @() }; $yaml = @('openai-api-base: ' + ($baseUrl | ConvertTo-Json -Compress), 'openai-api-key: ' + ($apiKey | ConvertTo-Json -Compress), 'model: ' + ($model | ConvertTo-Json -Compress), 'reasoning-effort: "medium"'); @($lines + $yaml) | Set-Content $config -Encoding UTF8`;
}

// ============================================================================
// 4. OpenCode (~/.config/opencode/opencode.json)
// ============================================================================

function opencodeUnixCommand({ baseUrl, apiKey, model }) {
  return unixPermanentCommand("opencode", { baseUrl, apiKey, model }, "$HOME/.config/opencode", "$HOME/.config/opencode/opencode.json");
}

function opencodeWindowsCommand({ baseUrl, apiKey, model }) {
  const normalizedBaseUrl = normalizeGatewayBaseUrl(baseUrl);
  return `${powershellValueDeclarations({ baseUrl: normalizedBaseUrl, apiKey, model })}; $configDir = Join-Path $HOME '.config\\opencode'; $config = Join-Path $configDir 'opencode.json'; New-Item -ItemType Directory -Force -Path $configDir | Out-Null; if (Test-Path $config) { Copy-Item $config "$config.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }; $data = [PSCustomObject]@{}; if (Test-Path $config) { try { $data = Get-Content $config -Raw | ConvertFrom-Json } catch {} }; $data | Add-Member -MemberType NoteProperty -Name '$schema' -Value 'https://opencode.ai/config.json' -Force; $data | Add-Member -MemberType NoteProperty -Name 'model' -Value ("config-studio/$model") -Force; if (-not ($data.PSObject.Properties['provider'])) { $data | Add-Member -MemberType NoteProperty -Name 'provider' -Value ([PSCustomObject]@{}) -Force }; if (-not ($data.provider.PSObject.Properties['config-studio'])) { $data.provider | Add-Member -MemberType NoteProperty -Name 'config-studio' -Value ([PSCustomObject]@{}) -Force }; $provider = $data.provider.'config-studio'; $provider | Add-Member -MemberType NoteProperty -Name 'npm' -Value '@ai-sdk/openai-compatible' -Force; $provider | Add-Member -MemberType NoteProperty -Name 'name' -Value 'Config Studio Gateway' -Force; if (-not ($provider.PSObject.Properties['options'])) { $provider | Add-Member -MemberType NoteProperty -Name 'options' -Value ([PSCustomObject]@{}) -Force }; $provider.options | Add-Member -MemberType NoteProperty -Name 'baseURL' -Value $baseUrl -Force; $provider.options | Add-Member -MemberType NoteProperty -Name 'apiKey' -Value $apiKey -Force; if (-not ($provider.PSObject.Properties['models'])) { $provider | Add-Member -MemberType NoteProperty -Name 'models' -Value ([PSCustomObject]@{}) -Force }; $provider.models | Add-Member -MemberType NoteProperty -Name $model -Value ([PSCustomObject]@{ name = $model; options = [PSCustomObject]@{ reasoningEffort = 'medium' } }) -Force; $data | ConvertTo-Json -Depth 20 | Set-Content -Path $config -Encoding UTF8`;
}

// ============================================================================
// Factory & Path Registries
// ============================================================================

/**
 * Creates the setup command based on the target platform and client.
 */
export function createSetupCommand(platform, values = {}) {
  const client = values.client || "claude";
  const isWindows = platform === "windows";
  let command;

  switch (client) {
    case "claude":
      command = isWindows ? claudeWindowsCommand(values) : claudeUnixCommand(values);
      break;
    case "codex":
      command = isWindows ? codexWindowsCommand(values) : codexUnixCommand(values);
      break;
    case "aider":
      command = isWindows ? aiderWindowsCommand(values) : aiderUnixCommand(values);
      break;
    case "opencode":
      command = isWindows ? opencodeWindowsCommand(values) : opencodeUnixCommand(values);
      break;
    default:
      command = isWindows ? claudeWindowsCommand(values) : claudeUnixCommand(values);
  }

  if (isWindows) command = windowsPermanentProgress(client, command);
  const target = permanentLaunchTarget(client, values.model);
  return appendInteractiveLaunch(platform, target, command, values.launch !== false, "permanent");
}

/**
 * Creates session-only environment assignments without changing config files.
 */
export function createTemporaryCommand(platform, values = {}) {
  const parts = temporaryCommandParts(platform, values);
  return appendInteractiveLaunch(platform, parts.target, parts.command, values.launch !== false, "temporary");
}

/**
 * File path mappings for each supported client across OS platforms.
 */
export const configPaths = {
  claude: {
    unix: "~/.claude/settings.json",
    windows: "$HOME\\.claude\\settings.json",
  },
  codex: {
    unix: "~/.codex/config.toml",
    windows: "$HOME\\.codex\\config.toml",
  },
  aider: {
    unix: "~/.aider.conf.yml",
    windows: "$HOME\\.aider.conf.yml",
  },
  opencode: {
    unix: "~/.config/opencode/opencode.json",
    windows: "$HOME\\.config\\opencode\\opencode.json",
  },
};

/**
 * Clients that can be restored, with the paths each restore command touches.
 */
const restoreTargets = {
  claude: {
    name: "Claude Code",
    unixPath: "$HOME/.claude/settings.json",
    unixDisplay: "~/.claude/settings.json",
    windowsPath: ".claude\\settings.json",
    windowsDisplay: "$HOME\\.claude\\settings.json",
    fileName: "settings.json",
  },
  codex: {
    name: "Codex CLI",
    unixPath: "$HOME/.codex/config.toml",
    unixDisplay: "~/.codex/config.toml",
    windowsPath: ".codex\\config.toml",
    windowsDisplay: "$HOME\\.codex\\config.toml",
    fileName: "config.toml",
  },
  aider: {
    name: "Aider",
    unixPath: "$HOME/.aider.conf.yml",
    unixDisplay: "~/.aider.conf.yml",
    windowsPath: ".aider.conf.yml",
    windowsDisplay: "$HOME\\.aider.conf.yml",
    fileName: ".aider.conf.yml",
  },
  opencode: {
    name: "OpenCode",
    unixPath: "$HOME/.config/opencode/opencode.json",
    unixDisplay: "~/.config/opencode/opencode.json",
    windowsPath: ".config\\opencode\\opencode.json",
    windowsDisplay: "$HOME\\.config\\opencode\\opencode.json",
    fileName: "opencode.json",
  },
};

/**
 * Restores the newest timestamped backup. Backup names sort chronologically, so
 * the last match of the sorted glob is the newest one. The configuration that is
 * about to be replaced is kept as a `.prerestore-` copy, which the `.bak-*` glob
 * never matches, so repeating the restore stays predictable.
 */
function unixRestoreCommand({ name, unixPath, unixDisplay }) {
  return `(
config="${unixPath}"
latest=""
for candidate in "$config".bak-*; do
  [ -e "$candidate" ] && latest="$candidate"
done

if [ -z "$latest" ]; then
  printf '%s\\n' 'No backup found for ${name} (${unixDisplay}).' >&2
  exit 1
fi

if [ -f "$config" ]; then
  printf '%s\\n' '[1/2] Saving the current configuration before restoring.'
  cp "$config" "$config.prerestore-$(date +%Y%m%d-%H%M%S)"
else
  printf '%s\\n' '[1/2] No current configuration to save.'
fi

cp "$latest" "$config"
printf '%s\\n' "[2/2] Restored ${name} from $latest"
)`;
}

function windowsRestoreCommand({ name, windowsPath, windowsDisplay, fileName }) {
  return `$config = Join-Path $HOME '${windowsPath}'; $latest = Get-ChildItem -LiteralPath (Split-Path $config) -Filter '${fileName}.bak-*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1; if (-not $latest) { Write-Error 'No backup found for ${name} (${windowsDisplay}).' } else { if (Test-Path -LiteralPath $config) { Write-Host '[1/2] Saving the current configuration before restoring.'; Copy-Item -LiteralPath $config -Destination "$config.prerestore-$(Get-Date -Format 'yyyyMMdd-HHmmss')" -Force } else { Write-Host '[1/2] No current configuration to save.' }; Copy-Item -LiteralPath $latest.FullName -Destination $config -Force; Write-Host "[2/2] Restored ${name} from $($latest.Name)" -ForegroundColor Green }`;
}

/**
 * Rollback commands to restore the latest backup for each client.
 */
export const revertCommands = Object.fromEntries([
  ...Object.entries(restoreTargets).map(([client, target]) => [client, {
    unix: unixRestoreCommand(target),
    windows: windowsRestoreCommand(target),
  }]),
  // Backward compatibility fallback
  ["unix", unixRestoreCommand(restoreTargets.claude)],
  ["windows", windowsRestoreCommand(restoreTargets.claude)],
]);

/**
 * Retrieves the rollback command for a given platform and client.
 */
export function getRevertCommand(platform, client = "claude") {
  const target = revertCommands[client] || revertCommands.claude;
  return target[platform] || "";
}
