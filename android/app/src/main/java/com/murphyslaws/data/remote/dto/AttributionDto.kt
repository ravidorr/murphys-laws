package com.murphyslaws.data.remote.dto

import com.google.gson.annotations.SerializedName
import com.murphyslaws.domain.model.Attribution

data class AttributionDto(
    @SerializedName("name")
    val name: String,
    @SerializedName("contact_type")
    val contactType: String?,
    @SerializedName("contact_value")
    val contactValue: String?
)

fun AttributionDto.toDomain(): Attribution {
    return Attribution(
        name = name,
        contactType = contactType,
        contactValue = contactValue
    )
}
