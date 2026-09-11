module Api
  module V1
    class PresetsController < ApplicationController
      def index
        # Fallback presets in-memory dataset if database is fresh
        # Fallback set mirrors the client's 730BT library in
        # `frontend/src/store/useAudioStore.ts` — keep the ids in sync.
        default_presets = [
          {
            id: "jbl730-reference",
            name: "730BT Reference",
            description: "The house correction: Pure Bass shelf neutralised, scooped mids restored, 8 kHz peak tamed.",
            headphoneModel: "JBL Tune 730BT",
            eqGains: [-3, -5, -4, -1.5, 0.5, 1.5, 2.5, 1, -2.5, 1.5],
            reverbPreset: "none",
            author: "AuraTune",
            likes: 412
          },
          {
            id: "jbl730-sub",
            name: "Sub Extension",
            description: "Bass without the mud: lifts the 31 Hz sub the 40 mm driver rolls off while cutting the 125 Hz bloom.",
            headphoneModel: "JBL Tune 730BT",
            eqGains: [4, 1, -3, -2, -0.5, 1, 2, 1, -2, 1],
            reverbPreset: "none",
            author: "AuraTune Audio Lab",
            likes: 358
          },
          {
            id: "jbl730-vocal",
            name: "Voice & Podcast",
            description: "Clears the bass shelf out of the way so speech sits forward and stays intelligible.",
            headphoneModel: "JBL Tune 730BT",
            eqGains: [-6, -6, -3, 0, 2.5, 4, 3.5, 1.5, -2, 0],
            reverbPreset: "none",
            author: "AuraTune Audio Lab",
            likes: 241
          },
          {
            id: "jbl730-commute",
            name: "Commute (no ANC)",
            description: "The 730BT isolates passively only. Cuts the low end that traffic rumble already masks and lifts what survives it.",
            headphoneModel: "JBL Tune 730BT",
            eqGains: [-8, -7, -4, -1, 2, 3, 3, 2, -1, 0],
            reverbPreset: "none",
            author: "AuraTune",
            likes: 187
          }
        ]

        if defined?(Preset) && Preset.table_exists? && Preset.any?
          render json: Preset.all
        else
          render json: default_presets
        end
      end

      def create
        preset_params = params.require(:preset).permit(:name, :description, :headphoneModel, :reverbPreset, :author, eqGains: [])
        
        preset = {
          id: "custom-#{Time.now.to_i}",
          name: preset_params[:name],
          description: preset_params[:description],
          headphoneModel: preset_params[:headphoneModel] || "JBL Tune Series",
          eqGains: preset_params[:eqGains] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          reverbPreset: preset_params[:reverbPreset] || "none",
          author: preset_params[:author] || "Cloud User",
          likes: 1
        }

        render json: preset, status: :created
      end

      def like
        render json: { status: "success", message: "Liked preset successfully" }
      end
    end
  end
end
