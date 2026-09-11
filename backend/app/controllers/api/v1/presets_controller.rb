module Api
  module V1
    class PresetsController < ApplicationController
      def index
        # Fallback presets in-memory dataset if database is fresh
        default_presets = [
          {
            id: "jbl-tune-bass",
            name: "JBL Tune Bass Boost",
            description: "Deep punchy low-end optimized for JBL Tune 750BT / 760NC driver responsiveness.",
            headphoneModel: "JBL Tune 760NC",
            eqGains: [8, 6, 4, 1, 0, -1, 0, 2, 4, 5],
            reverbPreset: "room",
            author: "AuraTune Audio Lab",
            likes: 342
          },
          {
            id: "vocal-clarity",
            name: "Vocal & Podcast Clarity",
            description: "Lift mid-range frequencies and roll off sub-bass rumble for crisp speech intelligibility.",
            headphoneModel: "Universal / Studio",
            eqGains: [-4, -2, 0, 2, 5, 6, 4, 2, 1, 0],
            reverbPreset: "none",
            author: "AuraTune Audio Lab",
            likes: 218
          },
          {
            id: "acoustic-warmth",
            name: "Acoustic Warmth",
            description: "Smooth organic acoustic signature with gentle treble roll-off and warm lower mids.",
            headphoneModel: "Sennheiser / Open-Back",
            eqGains: [3, 4, 3, 1, -1, 0, 1, 2, 0, -2],
            reverbPreset: "hall",
            author: "Auralist",
            likes: 184
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
