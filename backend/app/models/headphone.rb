class Headphone < ApplicationRecord
  # brand: string
  # model_name: string
  # driver_size: string
  # bluetooth_version: string
  # anc_supported: boolean
  # default_preset_id: string

  validates :model_name, presence: true

  def as_json(options = {})
    {
      id: id,
      brand: brand,
      modelName: model_name,
      driverSize: driver_size,
      bluetoothVersion: bluetooth_version,
      ancSupported: anc_supported,
      defaultPresetId: default_preset_id
    }
  end
end
