<script>
import { Checkbox } from '@components/Form/Checkbox';
import ColorInput from '@shell/components/form/ColorInput';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { RadioGroup } from '@components/Form/Radio';
import { _EDIT, _VIEW } from '@shell/config/query-params';

export default ({
  name: 'BannerSettings',

  props: {
    value: {
      type:    Object,
      default: () => {}
    },
    mode: {
      type: String,
      validator(value) {
        return [_EDIT, _VIEW].includes(value);
      },
      default: _EDIT,
    },
    bannerType: {
      type:     String,
      required: true
    }
  },

  components: {
    Checkbox, ColorInput, LabeledInput, LabeledSelect, RadioGroup
  },

  data() {
    const showAsDialog = !!this.value[this.bannerType]?.button || false;
    const buttonText = this.value[this.bannerType]?.button || this.t('banner.showAsDialog.defaultButtonText');

    return {
      showAsDialog,
      buttonText,
      uiBannerFontSizeOptions: ['10px', '12px', '14px', '16px', '18px', '20px'],
      themeVars:               {
        bannerBgColor:   getComputedStyle(document.body).getPropertyValue('--default'),
        bannerTextColor: getComputedStyle(document.body).getPropertyValue('--banner-text-color')
      },
      bannerTitleId: `describe-banners-${ this.bannerType }-id`
    };
  },

  watch: {
    showAsDialog(neu, old) {
      if (neu !== old && !neu) {
        this.value[this.bannerType].button = '';
      } else {
        this.value[this.bannerType].button = this.buttonText;
      }
    },

    buttonText(neu, old) {
      if (neu !== old) {
        this.value[this.bannerType].button = neu;
      }
    }
  },

  computed: {
    radioOptions() {
      const options = ['left', 'center', 'right'];
      const labels = [
        this.t('banner.bannerAlignment.leftOption'),
        this.t('banner.bannerAlignment.centerOption'),
        this.t('banner.bannerAlignment.rightOption'),
      ];

      return { options, labels };
    },

    isUiDisabled() {
      return this.mode === _VIEW;
    },

    textDecorationOptions() {
      const options = [
        {
          style: 'fontWeight',
          label: this.t('banner.bannerDecoration.bannerBold')
        },
        {
          style: 'fontStyle',
          label: this.t('banner.bannerDecoration.bannerItalic')
        },
        {
          style: 'textDecoration',
          label: this.t('banner.bannerDecoration.bannerUnderline')
        }
      ];

      return options;
    },
    isConsentBanner() {
      return this.bannerType === 'bannerConsent';
    }
  }
});
</script>

<template>
  <div class="row mb-20">
    <div class="col span-12">
      <div class="row">
        <p
          :id="bannerTitleId"
          class="sr-only"
        >
          {{ t(`banner.${bannerType}`) }}
        </p>
        <div class="col span-6">
          <LabeledInput
            v-model:value="value[bannerType].text"
            :disabled="isUiDisabled"
            :label="t('banner.text')"
            type="multiline"
            :aria-describedby="bannerTitleId"
          />
          <p
            v-if="isConsentBanner"
            class="banner-input-footnote mt-5 mb-20"
          >
            {{ t('banner.consentFootnote') }}
          </p>
          <div
            v-if="isConsentBanner"
            class="mt-10"
          >
            <Checkbox
              v-model:value="showAsDialog"
              name="bannerDecoration"
              class="banner-decoration-checkbox"
              :mode="mode"
              :label="t('banner.showAsDialog.label')"
              :tooltip="t('banner.showAsDialog.tooltip')"
              :aria-describedby="bannerTitleId"
            />
            <LabeledInput
              v-model:value="buttonText"
              :disabled="!showAsDialog || isUiDisabled"
              :label="t('banner.buttonText')"
              :aria-describedby="bannerTitleId"
            />
          </div>
        </div>
        <div class="col span-2">
          <RadioGroup
            v-model:value="value[bannerType].textAlignment"
            name="bannerAlignment"
            :data-testid="`banner_alignment_radio_options${bannerType}`"
            :label="t('banner.bannerAlignment.label')"
            :options="radioOptions.options"
            :labels="radioOptions.labels"
            :mode="mode"
            :aria-label="`${t(`banner.${bannerType}`)} ${t('banner.bannerAlignment.label')}`"
          />
        </div>
        <div class="col span-2">
          <h3 id="decoration-banner-title-id">
            {{ t('banner.bannerDecoration.label') }}
          </h3>
          <div
            v-for="(o, i) in textDecorationOptions"
            :key="i"
          >
            <Checkbox
              v-model:value="value[bannerType][o.style]"
              name="bannerDecoration"
              :data-testid="`banner_decoration_checkbox${bannerType}${o.label}`"
              class="banner-decoration-checkbox"
              :mode="mode"
              :label="o.label"
              :aria-describedby="`${bannerTitleId} decoration-banner-title-id`"
            />
          </div>
        </div>
        <div class="col span-2">
          <LabeledSelect
            v-model:value="value[bannerType].fontSize"
            :data-testid="`banner_font_size_options${bannerType}`"
            :disabled="isUiDisabled"
            :label="t('banner.bannerFontSize.label')"
            :options="uiBannerFontSizeOptions"
            :aria-describedby="bannerTitleId"
          />
        </div>
      </div>
      <div class="row mt-10">
        <div class="col span-6">
          <ColorInput
            v-model:value="value[bannerType].color"
            :default-value="themeVars.bannerTextColor"
            :label="t('banner.textColor')"
            :mode="mode"
            :aria-label="`${t(`banner.${bannerType}`)} ${t('banner.textColor')}`"
          />
        </div>
        <div class="col span-6">
          <ColorInput
            v-model:value="value[bannerType].background"
            :default-value="themeVars.bannerBgColor"
            :label="t('banner.background')"
            :mode="mode"
            :aria-label="`${t(`banner.${bannerType}`)} ${t('banner.background')}`"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang='scss'>
.banner-input-footnote {
  font-size: 12px;
  opacity: 0.8;
}

.banner-decoration-checkbox {
  position: relative;
  display: inline-flex;
  align-items: flex-start;
  margin: 0;
  cursor: pointer;
  user-select: none;
  border-radius: var(--border-radius);
  padding-bottom: 5px;
  height: 24px;
}
</style>
