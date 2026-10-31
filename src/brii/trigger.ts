export const commandTriggers=[';;','//','--','\\\\'] as const;
export type CommandTrigger=typeof commandTriggers[number];
export function selectedTrigger(value:unknown):CommandTrigger{
 return commandTriggers.includes(value as CommandTrigger)?value as CommandTrigger:';;';
}
