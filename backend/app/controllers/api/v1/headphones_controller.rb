module Api
  module V1
    class HeadphonesController < ApplicationController
      def index
        # The 730BT is the model this build targets, so it leads the list and
        # carries the house preset; the rest are fallbacks.
        headphones = [
          {
            id: "jbl-tune-730bt",
            brand: "JBL",
            modelName: "Tune 730BT",
            driverSize: "40mm Dynamic",
            bluetoothVersion: "6.0 / LE Audio",
            ancSupported: false,
            defaultPresetId: "jbl730-reference"
          },
          {
            id: "jbl-tune-770nc",
            brand: "JBL",
            modelName: "Tune 770NC",
            driverSize: "40mm Dynamic",
            bluetoothVersion: "5.3",
            ancSupported: true,
            defaultPresetId: "jbl730-reference"
          },
          {
            id: "jbl-tune-510bt",
            brand: "JBL",
            modelName: "Tune 510BT",
            driverSize: "32mm Dynamic",
            bluetoothVersion: "5.0",
            ancSupported: false,
            defaultPresetId: "jbl730-reference"
          },
          {
            id: "sony-wh1000xm5",
            brand: "Sony",
            modelName: "WH-1000XM5",
            driverSize: "30mm Precision",
            bluetoothVersion: "5.2",
            ancSupported: true,
            defaultPresetId: "jbl730-stock"
          }
        ]

        render json: headphones
      end
    end
  end
end
