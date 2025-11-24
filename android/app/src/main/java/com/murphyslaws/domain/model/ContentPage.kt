package com.murphyslaws.domain.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
enum class ContentPage(val filename: String, val title: String) : Parcelable {
    ABOUT("about", "About"),
    PRIVACY("privacy", "Privacy Policy"),
    TERMS("terms", "Terms of Service"),
    CONTACT("contact", "Contact");

    val markdownFile: String get() = "$filename.md"
}
