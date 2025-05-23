<script>
import { CAPI, MANAGEMENT } from '@shell/config/types';
import AsyncButton from '@shell/components/AsyncButton';
import { downloadFile } from '@shell/utils/download';
import { filterOnlyKubernetesClusters, filterHiddenLocalCluster } from '@shell/utils/cluster';
import { sortBy } from '@shell/utils/sort';

export default {
  name: 'Diagnostic',

  components: { AsyncButton },

  async fetch() {
    const provClusters = await this.$store.dispatch('management/findAll', { type: CAPI.RANCHER_CLUSTER });
    const readyClusters = provClusters.filter((c) => c.mgmt?.isReady);
    const clusterForCounts = filterHiddenLocalCluster(filterOnlyKubernetesClusters(readyClusters, this.$store), this.$store);
    const finalCounts = [];
    const promises = [];
    const topFifteenForResponseTime = [];
    const schemaPromises = [];

    clusterForCounts.forEach((cluster, i) => {
      // Necessary to retrieve the proper display name of the cluster
      const mgmtCluster = this.$store.getters['management/byId'](MANAGEMENT.CLUSTER, cluster.metadata.name);

      finalCounts.push({
        id:             cluster.id,
        name:           mgmtCluster?.spec?.displayName || cluster.metadata?.name,
        namespace:      cluster.metadata?.namespace,
        capiId:         cluster.mgmt?.id,
        counts:         null,
        isTableVisible: !!(i === 0 && clusterForCounts.length === 1)
      });
      promises.push(this.$store.dispatch('management/request', { url: `/k8s/clusters/${ cluster.mgmt?.id }/v1/counts` }));
      schemaPromises.push(this.$store.dispatch('management/request', { url: `/k8s/clusters/${ cluster.mgmt?.id }/v1/schemas?exclude=metadata.managedFields` }));
    });

    const countsPerCluster = await Promise.all(promises);
    const schemasPerCluster = await Promise.all(schemaPromises);

    countsPerCluster.forEach((clusterCount, index) => {
      const counts = clusterCount.data?.[0]?.counts;

      if (counts) {
        const sanitizedCount = [];
        let finalCount = [];

        Object.keys(counts).forEach((key) => {
          sanitizedCount[key] = counts[key].summary?.count;
          sanitizedCount.push({
            resource: key,
            count:    counts[key].summary?.count || 0,
          });
        });

        const sortedCount = sortBy(sanitizedCount, 'count:desc');

        finalCount = finalCount.concat(sortedCount);
        finalCount = sortBy(finalCount, 'count:desc');
        finalCount = finalCount.splice(0, 15);

        finalCount.forEach((item, i) => {
          finalCount[i].id = finalCounts[index].id;
          finalCount[i].capiId = finalCounts[index].capiId;
        });

        topFifteenForResponseTime.push(finalCount);

        finalCounts[index].counts = sortedCount;
      }
    });

    this.topFifteenForResponseTime = topFifteenForResponseTime;
    this.finalCounts = finalCounts;

    // Schemas
    schemasPerCluster.forEach((schemas, index) => {
      finalCounts[index].schemaCount = schemas?.data?.length || 0;
      finalCounts[index].customSchemas = (schemas?.data?.filter((schema) => {
        return schema.attributes?.group.includes('.') && !schema.attributes?.group.includes('.cattle.io') && !schema.attributes?.group.includes('.k8s.io');
      }).map((schema) => schema.id) || []).sort();
    });
  },

  data() {
    return {
      systemInformation:         null,
      topFifteenForResponseTime: null,
      responseTimes:             null,
      finalCounts:               null,
      includeResponseTimes:      true,
    };
  },

  created() {
    const {
      userAgent,
      userAgentData,
      language,
      cookieEnabled,
      hardwareConcurrency,
      deviceMemory
    } = window?.navigator;

    const systemInformation = {
      browser: {
        label: this.t('about.diagnostic.systemInformation.browser'),
        value: this.t('about.diagnostic.systemInformation.browserInfo', {
          userAgent, language, cookieEnabled
        })
      },
      system: {
        label: this.t('about.diagnostic.systemInformation.system'),
        value: this.t('about.diagnostic.systemInformation.hardwareConcurrency', { hardwareConcurrency })
      },
      jsMemory: {
        label: this.t('about.diagnostic.systemInformation.jsMemory'),
        value: ''
      }
    };

    if ( userAgentData?.platform ) {
      systemInformation.system.value = systemInformation.system.value.concat(', ', this.t('about.diagnostic.systemInformation.os', { platform: userAgentData.platform }));
    }

    if ( deviceMemory ) {
      systemInformation.system.value = systemInformation.system.value.concat(', ', this.t('about.diagnostic.systemInformation.deviceMemory', { deviceMemory }));
    }

    if ( window?.performance?.memory?.jsHeapSizeLimit ) {
      systemInformation.jsMemory.value += this.t('about.diagnostic.systemInformation.memJsHeapLimit', { jsHeapSizeLimit: window?.performance?.memory?.jsHeapSizeLimit });
    }

    if ( window?.performance?.memory?.totalJSHeapSize ) {
      systemInformation.jsMemory.value += `, ${ this.t('about.diagnostic.systemInformation.memTotalJsHeapSize', { totalJSHeapSize: window?.performance?.memory?.totalJSHeapSize }) }`;
    }

    if ( window?.performance?.memory?.usedJSHeapSize ) {
      systemInformation.jsMemory.value += `, ${ this.t('about.diagnostic.systemInformation.memUsedJsHeapSize', { usedJSHeapSize: window?.performance?.memory?.usedJSHeapSize }) }`;
    }

    this.systemInformation = systemInformation;
  },

  computed: {
    clusterCount() {
      return this.finalCounts?.length;
    }
  },

  methods: {
    generateKey(data) {
      const randomize = Math.random() * 10000;

      return `key_${ randomize }_${ data }`;
    },

    downloadData(btnCb) {
      // simplify filename due to e2e tests
      const fileName = 'rancher-diagnostic-data.json';
      const data = {
        systemInformation: this.systemInformation,
        storeMapping:      this.parseStoreData(this.$store?._modules?.root?.state),
        resourceCounts:    this.finalCounts,
        responseTimes:     this.responseTimes,
      };

      downloadFile(fileName, JSON.stringify(data), 'application/json')
        .then(() => btnCb(true))
        .catch(() => btnCb(false));
    },

    setResourceResponseTiming(responseTimes) {
      responseTimes?.forEach((res) => {
        if ( res.outcome === 'success' ) {
          const cluster = this.finalCounts.find((c) => c.capiId === res.item.capiId);
          const countIndex = cluster?.counts?.findIndex((c) => c.resource === res.item.resource);

          if ( (countIndex && countIndex !== -1) || countIndex === 0 ) {
            cluster.counts[countIndex]['durationMs'] = res.durationMs;
          }
        }
      });
    },

    sumResourceCount(counts) {
      return counts.reduce((a, b) => (a + b.count), 0);
    },

    nodeCount(counts) {
      const resource = counts.findIndex((c) => c.resource === 'node');

      return counts[resource]?.count;
    },

    toggleTable(area) {
      const itemIndex = this.finalCounts.findIndex((item) => item.id === area);

      this.finalCounts[itemIndex].isTableVisible = !this.finalCounts[itemIndex].isTableVisible;
    },

    async gatherResponseTimes(btnCb) {
      const promises = this.topFifteenForResponseTime.flatMap((cluster) => {
        return cluster.map((item) => {
          const t = Date.now();

          return this.$store.dispatch('management/request', { url: `/k8s/clusters/${ item.capiId }/v1/${ item.resource }` })
            .then(() => ({
              outcome: 'success', item, durationMs: Date.now() - t
            }))
            .catch(() => ({
              outcome: 'error', item, durationMs: Date.now() - t
            }));
        });
      });

      return await Promise.all(promises).then((responseTimes) => {
        this.responseTimes = responseTimes;
        this.setResourceResponseTiming(responseTimes);
        btnCb(true);
      }).catch(() => btnCb(false));
    },

    parseStoreData(rootStore) {
      // clear potential sensitive data
      const disallowedDataKeys = [
        'aws',
        'digitalocean',
        'linode',
        'targetRoute', // contains circular references, isn't useful (added later to store)
        '$router', // also contains a circular reference to $store, not useful for diagnostics
        '$route', // also contains a circular reference to $store, not useful for diagnostics
      ];

      const clearListsKeys = [
        'management',
        'rancher',
        'cluster',
        'harvester',
        'epinio',
        'elemental',
      ];

      const cleanRootStore = {};

      Object.entries(rootStore).forEach(([storeKey, store]) => {
        if (disallowedDataKeys.includes(storeKey)) {
          // Ignore any root store in the disallowed list
          return;
        }

        // Remove all `list` keys, for example `management.types['management.cattle.io.cluster'].list`

        if (!clearListsKeys.includes(storeKey)) {
          // This is only done for some store namespaces, if not just save the raw entry
          cleanRootStore[storeKey] = store;

          return;
        }

        // if there's no types property to clear, just save the raw entry
        if (!Object.keys(store.types || {}).length) {
          cleanRootStore[storeKey] = store;

          return;
        }

        // Save the root entry with empty types prop
        cleanRootStore[storeKey] = {
          ...store,
          types: {},
        };

        // Save the root entries type's entries without the list property
        Object.entries(store.types).forEach(([type, entry]) => {
          const { list, ...otherProps } = entry;

          cleanRootStore[storeKey].types[type] = {
            ...otherProps,
            count: list.length,
          };
        });
      });

      return cleanRootStore;
    },

    promptDownload(btnCb) {
      if ( !this.responseTimes ) {
        this.$store.dispatch('management/promptModal', {
          component:      'DiagnosticTimingsDialog',
          componentProps: {
            downloadData:        this.downloadData,
            gatherResponseTimes: this.gatherResponseTimes
          }
        })
          .then(() => btnCb(true))
          .catch(() => btnCb(false));
      } else {
        this.downloadData(btnCb);
      }
    }
  },
};
</script>

<template>
  <div>
    <div class="title-block mt-20 mb-40">
      <div>
        <AsyncButton
          mode="timing"
          class="mr-20"
          data-testid="diagnostics-generate-response-times"
          @click="gatherResponseTimes"
        />
        <AsyncButton
          mode="diagnostic"
          data-testid="diagnostics-download-diagnostic-package"
          @click="promptDownload"
        />
      </div>
    </div>

    <!-- System info -->
    <div class="mb-40">
      <h2 class="mb-20">
        {{ t('about.diagnostic.systemInformation.subtitle') }}
      </h2>
      <table class="full-width">
        <thead>
          <tr>
            <th>Type</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, objKey) in systemInformation"
            :key="objKey"
          >
            <template v-if="item.value.length">
              <td>{{ item.label }}</td>
              <td>{{ item.value }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Resources -->
    <div class="mb-40">
      <h2 class="mb-20">
        {{ t('about.diagnostic.resourceCounts', { count: clusterCount }) }}
      </h2>
      <div class="resources-count-container">
        <table
          v-for="(cluster, i) in finalCounts"
          :key="i"
          class="full-width"
        >
          <thead @click="toggleTable(cluster.id)">
            <tr>
              <th colspan="4">
                <div class="cluster-row">
                  <span>Cluster: <b>{{ cluster.name }}</b></span>
                  <span>Namespace: <b>{{ cluster.namespace }}</b></span>
                  <span>Total Resources: <b>{{ sumResourceCount(cluster.counts) }}</b></span>
                  <span>Total Schemas: <b>{{ cluster.schemaCount }}</b></span>
                  <span>Nodes: <b>{{ nodeCount(cluster.counts) }}</b></span>
                  <i
                    class="icon"
                    :class="{
                      'icon-chevron-down': !cluster.isTableVisible,
                      'icon-chevron-up': cluster.isTableVisible
                    }"
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody v-show="cluster.isTableVisible">
            <tr>
              <td colspan="3">
                <div class="schema-title">
                  Custom Schemas
                </div>
                <div class="custom-schemas">
                  <div
                    v-for="name in cluster.customSchemas"
                    :key="name"
                    class="schema-name"
                  >
                    {{ name }}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <th>
                Resource
              </th>
              <th>
                Count
              </th>
              <th>
                Resource Timing (ms)
              </th>
            </tr>

            <tr
              v-for="(item, j) in cluster.counts"
              :key="j"
            >
              <template v-if="item.count > 0">
                <td scope="row">
                  {{ item.resource }}
                </td>
                <td>{{ item.count }}</td>
                <td>{{ item.durationMs || '-' }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title-block {
  display: flex;
  justify-content: right;
  align-items: center;

  h1 {
    margin: 0 !important;
  }

  div {
    display: flex;
    align-items: center;
  }
}

table {
  border-collapse: collapse;
  overflow: hidden;
  border-radius: var(--border-radius);

  &.full-width {
    border-radius: 0 !important;
    min-width: 60%;

    thead {
      cursor: pointer;

      th div {
          display: flex;
          align-items: center;
          justify-content: space-between;
      }
    }

    tbody {
      border-bottom: 1px solid var(--sortable-table-top-divider);
    }
  }

  tr > td:first-of-type {
    width: 20%;
  }

  th, td {
    border: 1px solid var(--border);
    padding: 8px 5px;
    min-width: 150px;
    text-align: left;

    .schema-title {
      font-weight: bold;
      margin-bottom: 4px;
    }

    .custom-schemas {
      display: flex;
      flex-wrap: wrap;

      > .schema-name {
        margin-right: 5px;
        margin-bottom: 2px;
        border: 1px solid var(--border);
        padding: 2px 5px;
      }
    }
  }

  th {
    background-color: var(--sortable-table-top-divider);
    border-bottom: 1px solid var(--sortable-table-header-bg);
  }

  a {
    cursor: pointer;
  }

  .os {
    display: flex;
    align-items: center;
  }
}

.logs-container {
  list-style: none;
  margin: 0;
  padding: 0;
  background-color: #FFF;
  border: 1px solid var(--body-text);
  height: 300px;
  overflow-x: hidden;
  overflow-y: auto;

  li {
    font-family: $mono-font;
    font-size: 12px;
    margin: 0;
    padding: 10px 20px;
    border-bottom: 1px solid #ccc;

    &.log {
      color: #000;
    }

    &.warn {
      background-color: LightGoldenRodYellow;
      color: SaddleBrown;
    }

    &.info {
      background-color: Azure;
      color: blue;
    }

    &.error {
      background-color: MistyRose;
      color: red;
    }

    &:last-child {
      border-bottom: none;
    }

    .log-entry-type {
      font-weight: bold;
    }
  }
}

.resources-count-container {
  .cluster-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr) 20px;
    grid-template-rows: 1fr;
    align-content: center;
    font-weight: normal;
  }

  tbody tr, tbody tr th {
    background-color: var(--sortable-table-header-bg);
  }

  tbody tr th {
    border-bottom: 1px solid var(--sortable-table-top-divider);
  }

  tbody tr:hover {
    background-color: var(--sortable-table-top-divider);
  }
}
</style>
