import HomePagePo from '@/cypress/e2e/po/pages/home.po';
import AboutPagePo from '@/cypress/e2e/po/pages/about.po';
import DiagnosticsPagePo from '@/cypress/e2e/po/pages/diagnostics.po';

const aboutPage = new AboutPagePo();

describe('About Page', { testIsolation: 'on', tags: ['@generic', '@adminUser', '@standardUser'] }, () => {
  let navAboutPage = true;

  beforeEach(() => {
    cy.login();
    if (!navAboutPage) {
      aboutPage.goTo();
      aboutPage.waitForPage();
    }
  });

  it('can navigate to About page', () => {
    HomePagePo.goToAndWaitForGet();
    AboutPagePo.navTo();
    aboutPage.waitForPage();
  });

  navAboutPage = false;

  it('no Prime info when community', { tags: '@noPrime' }, () => {
    aboutPage.rancherPrimeInfo().should('not.exist');
  });

  it('can navigate to Diagnostics page', () => {
    // AboutPagePo.navTo();
    // aboutPage.waitForPage();
    aboutPage.diagnosticsBtn().click();

    const diagnosticsPo = new DiagnosticsPagePo();

    diagnosticsPo.waitForPage();
  });

  it('can View release notes', () => {
    // AboutPagePo.navTo();
    // aboutPage.waitForPage();

    cy.getRancherVersion().then((version) => {
      const isPrime = version.RancherPrime === 'true';
      const expectedOrigin = isPrime ? 'https://documentation.suse.com' : 'https://github.com';
      const expectedPath = isPrime ? '/cloudnative/rancher-manager/latest/en/release-notes' : '/rancher/rancher/releases/tag/';

      aboutPage.clickVersionLink('View release notes');
      cy.origin(expectedOrigin, { args: { expectedPath } }, ({ expectedPath }) => {
        cy.location('pathname').should('include', expectedPath);
        cy.get('body').should('be.visible');
        cy.go('back');
      });
    });
  });

  describe('Versions', () => {
    // beforeEach(() => {
    //   aboutPage.goTo();
    // });

    it('can see rancher version', () => {
      // Check Rancher version
      cy.getRancherResource('v1', 'management.cattle.io.settings', 'server-version').then((resp: Cypress.Response<any>) => {
        const rancherVersion = resp.body['value'];

        cy.contains(rancherVersion).should('be.visible');
      });
    });

    it('can navigate to /rancher/rancher', () => {
      aboutPage.clickVersionLink('Rancher');
      cy.origin('https://github.com', () => {
        cy.location('pathname').should('eq', '/rancher/rancher');
        cy.get('body').should('be.visible');
        cy.go('back');
      });
    });

    it('can navigate to /rancher/dashboard', () => {
      aboutPage.clickVersionLink('Dashboard');
      cy.origin('https://github.com', () => {
        cy.location('pathname').should('eq', '/rancher/dashboard');
        cy.get('body').should('be.visible');
        cy.go('back');
      });
    });

    it('can navigate to /rancher/helm', () => {
      aboutPage.clickVersionLink('Helm');
      cy.origin('https://github.com', () => {
        cy.location('pathname').should('eq', '/rancher/helm');
        cy.get('body').should('be.visible');
        cy.go('back');
      });
    });

    it('can navigate to /rancher/machine', () => {
      aboutPage.clickVersionLink('Machine');
      cy.origin('https://github.com', () => {
        cy.location('pathname').should('eq', '/rancher/machine');
        cy.get('body').should('be.visible');
        cy.go('back');
      });
    });
  });

  describe('CLI Downloads', () => {
    // Shouldn't be needed with https://github.com/rancher/dashboard/issues/11393
    const expectedLinkStatusCode = 200;

    // workaround to make the following CLI tests work https://github.com/cypress-io/cypress/issues/8089#issuecomment-1585159023
    beforeEach(() => {
      // aboutPage.goTo();
      cy.intercept('GET', 'https://releases.rancher.com/cli2/**').as('download');
    });

    it('can download macOS CLI', () => {
      aboutPage.getLinkDestination('rancher-darwin').then((el) => {
        const macOsVersion = el.split('/')[5];

        aboutPage.getCliDownloadLinkByLabel('rancher-darwin').then((el: any) => {
          el.attr('download', '');
        }).click();
        cy.wait('@download').then(({ request, response }) => {
          expect(response?.statusCode).to.eq(expectedLinkStatusCode);
          expect(request.url).includes(macOsVersion);
        });
      });
    });

    it('can download Linux CLI', () => {
      aboutPage.getLinkDestination('rancher-linux').then((el) => {
        const linuxVersion = el.split('/')[5];

        aboutPage.getCliDownloadLinkByLabel('rancher-linux').then((el: any) => {
          el.attr('download', '');
        }).click();
        cy.wait('@download').then(({ request, response }) => {
          expect(response?.statusCode).to.eq(expectedLinkStatusCode);
          expect(request.url).includes(linuxVersion);
        });
      });
    });

    it('can download Windows CLI', () => {
      aboutPage.getLinkDestination('rancher-windows').then((el) => {
        const windowsVersion = el.split('/')[5];

        aboutPage.getCliDownloadLinkByLabel('rancher-windows').then((el: any) => {
          el.attr('download', '');
        }).click();
        cy.wait('@download').then(({ request, response }) => {
          expect(response?.statusCode).to.eq(expectedLinkStatusCode);
          expect(request.url).includes(windowsVersion);
        });
      });
    });
  });

  describe('Rancher Prime', { tags: '@prime' }, () => {
    function interceptVersionAndSetToPrime() {
      return cy.intercept('GET', '/rancherversion', {
        statusCode: 200,
        body:       {
          Version:      '9bf6631da',
          GitCommit:    '9bf6631da',
          RancherPrime: 'true'
        }
      });
    }

    beforeEach(() => {
      // cy.login();
      interceptVersionAndSetToPrime().as('rancherVersion');
    });

    it('should show prime panel on about page', () => {
      HomePagePo.goToAndWaitForGet();

      AboutPagePo.navTo();
      aboutPage.waitForPage();

      // Wait for the intercepted rancherversion request to complete
      cy.wait('@rancherVersion');

      aboutPage.rancherPrimeInfo().should('exist');
    });
  });
});
