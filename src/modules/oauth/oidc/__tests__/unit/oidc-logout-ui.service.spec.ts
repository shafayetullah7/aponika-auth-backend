import { OidcLogoutUiService } from '../../logout/oidc-logout-ui.service';

describe('OidcLogoutUiService', () => {
  const appEnv = {
    AUTH_FRONTEND_URL: 'http://localhost:3011',
  } as never;

  const providerForm = `<form id="op.logoutForm" method="post" action="/session/end/confirm">
<input type="hidden" name="xsrf" value="secret-xsrf"/>
</form>`;

  it('injects logout=yes so a scripted form.submit() destroys the SSO session', async () => {
    const service = new OidcLogoutUiService(appEnv);
    const ctx: { type?: string; status?: number; body?: string } = {};

    await service.logoutSource(ctx, providerForm);

    expect(ctx.status).toBe(200);
    expect(ctx.body).toContain('name="logout" value="yes"');
    expect(ctx.body).toContain('name="xsrf" value="secret-xsrf"');
    expect(ctx.body).toContain("document.getElementById('op.logoutForm').submit()");
  });

  it('does not duplicate logout when the provider already rendered it', async () => {
    const service = new OidcLogoutUiService(appEnv);
    const ctx: { type?: string; status?: number; body?: string } = {};
    const withLogout = providerForm.replace(
      '</form>',
      '<input type="hidden" name="logout" value="yes" /></form>',
    );

    await service.logoutSource(ctx, withLogout);

    const formHtml = ctx.body?.match(/<form[\s\S]*?<\/form>/)?.[0];
    expect(formHtml?.match(/name="logout"/g)).toHaveLength(1);
  });

  it('logs and leaves the form unchanged when markup has no closing form tag', async () => {
    const service = new OidcLogoutUiService(appEnv);
    const error = jest.spyOn(service['logger'], 'error').mockImplementation();
    const ctx: { type?: string; status?: number; body?: string } = {};

    await service.logoutSource(ctx, '<form id="op.logoutForm">');

    expect(error).toHaveBeenCalled();
    expect(ctx.body).not.toMatch(
      /<form[^>]*>[\s\S]*name="logout" value="yes"[\s\S]*<\/form>/,
    );
    error.mockRestore();
  });
});
