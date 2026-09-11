class Preset < ApplicationRecord
  # Attributes stored via JSON serialization or column attributes:
  # name: string
  # description: string
  # headphone_model: string
  # eq_gains: json / string array of 10 float values
  # reverb_preset: string ('none', 'room', 'hall', 'cathedral')
  # author: string
  # likes_count: integer

  validates :name, presence: true

  def as_json(options = {})
    {
      id: id || "custom-#{Time.now.to_i}",
      name: name,
      description: description,
      headphoneModel: headphone_model,
      eqGains: eq_gains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      reverbPreset: reverb_preset || "none",
      author: author || "AuraTune Community",
      likes: likes_count || 0
    }
  end
end
