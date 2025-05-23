import PagePo from '@/cypress/e2e/po/pages/page.po';
import ProductNavPo from '@/cypress/e2e/po/side-bars/product-side-nav.po';

export default class ClusterToolsPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${ clusterId }/explorer/tools`;
  }

  static goTo(clusterId: string): Cypress.Chainable<Cypress.AUTWindow> {
    return super.goTo(ClusterToolsPagePo.createPath(clusterId));
  }

  constructor(clusterId: string) {
    super(ClusterToolsPagePo.createPath(clusterId));
  }

  static navTo() {
    const sideNav = new ProductNavPo();

    sideNav.navToSideMenuEntryByLabel('Tools');
  }

  featureChartCards(): Cypress.Chainable {
    return cy.get('.grid > .item');
  }

  getCardByIndex(index: number): Cypress.Chainable {
    return this.featureChartCards().eq(index);
  }

  getCardByName(name: string): Cypress.Chainable {
    return this.featureChartCards().get(`[data-testid="cluster-tools-app-cluster/rancher-charts/${ name }"]`);
  }

  goToInstall(index: number) {
    return this.getCardByIndex(index).find('.btn').contains('Install').click();
  }

  deleteChart(name: string) {
    return this.getCardByName(name).find('.action .btn').eq(0).click();
  }

  editChart(index: number) {
    return this.getCardByIndex(index).find('.action .btn').eq(1).click();
  }

  getChartVersion(index: number) {
    return this.getCardByIndex(index).find('.version');
  }
}
