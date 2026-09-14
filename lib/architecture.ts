export const MAX_REFERENCES=2;
export const MAX_PROMPT_CHARS=2000;
export const DEFAULT_PRESERVE_RULES="除明确要求修改的部分外，保留主体身份、构图、视角及未指定区域。保持原图宽高比。遵守人物、物体数量与位置等明确限制，不要擅自增删内容。";
export function architecturePrompt(prompt:string,references:{role:string;name:string}[],baseLast=false,preserveRules:string=DEFAULT_PRESERVE_RULES){return `任务：图像编辑。
${baseLast?`第 ${references.length+1} 张（最后一张）图片是当前所选版本`:"第一张图片是当前所选版本"}，请基于该图继续编辑。
用户本轮要求：
${prompt}

${preserveRules.trim()?`本轮保留要求：\n${preserveRules}`:"本轮未设置额外保留要求。"}
参考图说明：
${references.map((r,i)=>`第 ${baseLast?i+1:i+2} 张图片：仅参考「${r.role}」，不得复制无关建筑或构图。`).join("\n")||"无参考图。"}
以当前所选版本继续编辑。`;}

export function creationPrompt(prompt:string){return `请根据以下文字描述创作一张完整图片。没有输入图片，不要要求用户上传图片。直接生成图片，不要仅提供文字说明。\n${prompt}`;}
