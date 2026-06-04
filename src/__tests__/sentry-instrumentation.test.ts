jest.mock("@sentry/nextjs", () => ({
  captureConsoleIntegration: jest.fn(() => ({ name: "CaptureConsole" })),
  captureRequestError: jest.fn(),
  captureRouterTransitionStart: jest.fn(),
  init: jest.fn(),
  replayIntegration: jest.fn(() => ({ name: "Replay" })),
}));

type SentryMock = {
  captureRequestError: jest.Mock;
  captureRouterTransitionStart: jest.Mock;
  init: jest.Mock;
  replayIntegration: jest.Mock;
};

describe("Sentry instrumentation bootstrap", () => {
  const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const originalRuntime = process.env.NEXT_RUNTIME;

  beforeEach(() => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
    delete process.env.NEXT_RUNTIME;
  });

  afterAll(() => {
    if (originalDsn === undefined) {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    } else {
      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    }

    if (originalRuntime === undefined) {
      delete process.env.NEXT_RUNTIME;
    } else {
      process.env.NEXT_RUNTIME = originalRuntime;
    }
  });

  it("exports Next onRequestError through Sentry.captureRequestError", async () => {
    const instrumentation = await import("../../instrumentation");
    const Sentry = jest.requireMock("@sentry/nextjs") as SentryMock;

    expect(instrumentation.onRequestError).toBe(Sentry.captureRequestError);
  });

  it("registers the node runtime Sentry config", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const instrumentation = await import("../../instrumentation");
    const Sentry = jest.requireMock("@sentry/nextjs") as SentryMock;

    await instrumentation.register();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0.1,
      }),
    );
  });

  it("initializes client monitoring and router transition capture once", async () => {
    const clientInstrumentation = await import("../../instrumentation-client");
    const Sentry = jest.requireMock("@sentry/nextjs") as SentryMock;

    expect(clientInstrumentation.onRouterTransitionStart).toBe(
      Sentry.captureRouterTransitionStart,
    );
    expect(Sentry.replayIntegration).toHaveBeenCalledWith({
      maskAllText: true,
      blockAllMedia: true,
    });
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        replaysOnErrorSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
      }),
    );
  });
});
