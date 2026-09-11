module Api
  module V1
    class HeadphonesController < ApplicationController
      def index
        headphones = [
          {
            id: "jbl-tune-760nc",
            brand: "JBL",
            modelName: "Tune 760NC",
            driverSize: "40mm Dynamic",
            bluetoothVersion: "5.0",
            ancSupported: true,
            defaultPresetId: "jbl-tune-bass"
          },
          {
            id: "jbl-tune-510bt",
            brand: "JBL",
            modelName: "Tune 510BT",
            driverSize: "32mm Dynamic",
            bluetoothVersion: "5.0",
            ancSupported: false,
            defaultPresetId: "jbl-tune-bass"
          },
          {
            id: "sony-wh1000xm5",
            brand: "Sony",
            modelName: "WH-1000XM5",
            driverSize: "30mm Precision",
            bluetoothVersion: "5.2",
            ancSupported: true,
            defaultPresetId: "flat-neutral"
          }
        ]

        render json: headphones
      end
    end
  end
end
