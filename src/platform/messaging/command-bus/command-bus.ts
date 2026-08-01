export interface Command<TPayload = unknown> {
  readonly name: string;
  readonly payload: TPayload;
}

export type CommandHandler<TCommand extends Command = Command, TResult = unknown> = (
  command: TCommand
) => Promise<TResult> | TResult;

export class CommandBus {
  private static instance: CommandBus;
  private handlers: Map<string, CommandHandler<any, any>> = new Map();

  private constructor() {}

  public static getInstance(): CommandBus {
    if (!CommandBus.instance) {
      CommandBus.instance = new CommandBus();
    }
    return CommandBus.instance;
  }

  public register<TCommand extends Command, TResult>(
    commandName: string,
    handler: CommandHandler<TCommand, TResult>
  ): () => void {
    if (this.handlers.has(commandName)) {
      throw new Error(`[CommandBus] Duplicate handler registered for command: "${commandName}"`);
    }
    this.handlers.set(commandName, handler);

    return () => {
      this.handlers.delete(commandName);
    };
  }

  public async execute<TCommand extends Command, TResult = unknown>(
    command: TCommand
  ): Promise<TResult> {
    const handler = this.handlers.get(command.name);
    if (!handler) {
      throw new Error(`[CommandBus] No handler registered for command: "${command.name}"`);
    }

    try {
      return await handler(command);
    } catch (err) {
      console.error(`[CommandBus Error] Failed executing command %s:`, command.name, err);
      throw err;
    }
  }
}

export const commandBus = CommandBus.getInstance();
